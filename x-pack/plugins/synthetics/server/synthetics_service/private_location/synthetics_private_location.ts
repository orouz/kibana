/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { KibanaRequest, SavedObjectsClientContract } from '@kbn/core/server';
import { NewPackagePolicy } from '@kbn/fleet-plugin/common';
import { NewPackagePolicyWithId } from '@kbn/fleet-plugin/server/services/package_policy';
import { formatSyntheticsPolicy } from '../../../common/formatters/format_synthetics_policy';
import { getSyntheticsPrivateLocations } from '../../legacy_uptime/lib/saved_objects/private_locations';
import {
  ConfigKey,
  HeartbeatConfig,
  MonitorFields,
  PrivateLocation,
  SourceType,
} from '../../../common/runtime_types';
import { UptimeServerSetup } from '../../legacy_uptime/lib/adapters';

export class SyntheticsPrivateLocation {
  private readonly server: UptimeServerSetup;

  constructor(_server: UptimeServerSetup) {
    this.server = _server;
  }

  async buildNewPolicy(
    savedObjectsClient: SavedObjectsClientContract
  ): Promise<NewPackagePolicy | undefined> {
    return await this.server.fleet.packagePolicyService.buildPackagePolicyFromPackage(
      savedObjectsClient,
      'synthetics',
      this.server.logger
    );
  }

  getPolicyId(config: HeartbeatConfig, { id: locId }: PrivateLocation, spaceId: string) {
    if (config[ConfigKey.MONITOR_SOURCE_TYPE] === SourceType.PROJECT) {
      return `${config.id}-${locId}`;
    }
    return `${config.id}-${locId}-${spaceId}`;
  }

  async generateNewPolicy(
    config: HeartbeatConfig,
    privateLocation: PrivateLocation,
    savedObjectsClient: SavedObjectsClientContract,
    newPolicyTemplate: NewPackagePolicy,
    spaceId: string
  ): Promise<NewPackagePolicy | null> {
    if (!savedObjectsClient) {
      throw new Error('Could not find savedObjectsClient');
    }

    const { label: locName } = privateLocation;

    const newPolicy = { ...newPolicyTemplate };

    try {
      newPolicy.is_managed = true;
      newPolicy.policy_id = privateLocation.agentPolicyId;
      if (config[ConfigKey.MONITOR_SOURCE_TYPE] === SourceType.PROJECT) {
        newPolicy.name = `${config.id}-${locName}`;
      } else {
        newPolicy.name = `${config[ConfigKey.NAME]}-${locName}-${spaceId}`;
      }
      newPolicy.namespace = config[ConfigKey.NAMESPACE];

      const { formattedPolicy } = formatSyntheticsPolicy(newPolicy, config.type, {
        ...(config as Partial<MonitorFields>),
        config_id: config.fields?.config_id,
        location_name: privateLocation.label,
        'monitor.project.id': config.fields?.['monitor.project.name'],
        'monitor.project.name': config.fields?.['monitor.project.name'],
      });

      return formattedPolicy;
    } catch (e) {
      this.server.logger.error(e);
      return null;
    }
  }

  async checkPermissions(request: KibanaRequest, error: string) {
    const {
      integrations: { writeIntegrationPolicies },
    } = await this.server.fleet.authz.fromRequest(request);

    if (!writeIntegrationPolicies) {
      throw new Error(error);
    }
  }

  async createMonitors(
    configs: HeartbeatConfig[],
    request: KibanaRequest,
    savedObjectsClient: SavedObjectsClientContract,
    privateLocations: PrivateLocation[],
    spaceId: string
  ) {
    await this.checkPermissions(
      request,
      `Unable to create Synthetics package policy for monitor. Fleet write permissions are needed to use Synthetics private locations.`
    );

    const newPolicies: NewPackagePolicyWithId[] = [];

    const newPolicyTemplate = await this.buildNewPolicy(savedObjectsClient);

    if (!newPolicyTemplate) {
      throw new Error(`Unable to create Synthetics package policy for private location`);
    }

    for (const config of configs) {
      try {
        const { locations } = config;

        const fleetManagedLocations = locations.filter((loc) => !loc.isServiceManaged);

        for (const privateLocation of fleetManagedLocations) {
          const location = privateLocations?.find((loc) => loc.id === privateLocation.id)!;

          if (!location) {
            throw new Error(
              `Unable to find Synthetics private location for agentId ${privateLocation.id}`
            );
          }

          const newPolicy = await this.generateNewPolicy(
            config,
            location,
            savedObjectsClient,
            newPolicyTemplate,
            spaceId
          );

          if (!newPolicy) {
            throw new Error(
              `Unable to create Synthetics package policy for monitor ${
                config[ConfigKey.NAME]
              } with private location ${location.label}`
            );
          }
          if (newPolicy) {
            newPolicies.push({ ...newPolicy, id: this.getPolicyId(config, location, spaceId) });
          }
        }
      } catch (e) {
        this.server.logger.error(e);
      }
    }

    if (newPolicies.length === 0) {
      throw new Error('Failed to build package policies for all monitors');
    }

    try {
      return await this.createPolicyBulk(newPolicies, savedObjectsClient);
    } catch (e) {
      this.server.logger.error(e);
    }
  }

  async editMonitor(
    config: HeartbeatConfig,
    request: KibanaRequest,
    savedObjectsClient: SavedObjectsClientContract,
    spaceId: string
  ) {
    await this.checkPermissions(
      request,
      `Unable to update Synthetics package policy for monitor ${
        config[ConfigKey.NAME]
      }. Fleet write permissions are needed to use Synthetics private locations.`
    );

    const { locations } = config;

    const allPrivateLocations = await getSyntheticsPrivateLocations(savedObjectsClient);

    const newPolicyTemplate = await this.buildNewPolicy(savedObjectsClient);

    if (!newPolicyTemplate) {
      throw new Error(`Unable to create Synthetics package policy for private location`);
    }

    const monitorPrivateLocations = locations.filter((loc) => !loc.isServiceManaged);

    for (const privateLocation of allPrivateLocations) {
      const hasLocation = monitorPrivateLocations?.some((loc) => loc.id === privateLocation.id);
      const currId = this.getPolicyId(config, privateLocation, spaceId);
      const hasPolicy = await this.getMonitor(currId, savedObjectsClient);
      try {
        if (hasLocation) {
          const newPolicy = await this.generateNewPolicy(
            config,
            privateLocation,
            savedObjectsClient,
            newPolicyTemplate,
            spaceId
          );

          if (!newPolicy) {
            throw new Error(
              `Unable to ${
                hasPolicy ? 'update' : 'create'
              } Synthetics package policy for private location ${privateLocation.label}`
            );
          }

          if (hasPolicy) {
            await this.updatePolicy(newPolicy, currId, savedObjectsClient);
          } else {
            await this.createPolicy(newPolicy, currId, savedObjectsClient);
          }
        } else if (hasPolicy) {
          const soClient = savedObjectsClient;
          const esClient = this.server.uptimeEsClient.baseESClient;
          try {
            await this.server.fleet.packagePolicyService.delete(soClient, esClient, [currId], {
              force: true,
            });
          } catch (e) {
            this.server.logger.error(e);
            throw new Error(
              `Unable to delete Synthetics package policy for monitor ${
                config[ConfigKey.NAME]
              } with private location ${privateLocation.label}`
            );
          }
        }
      } catch (e) {
        this.server.logger.error(e);
        throw new Error(
          `Unable to ${hasPolicy ? 'update' : 'create'} Synthetics package policy for monitor ${
            config[ConfigKey.NAME]
          } with private location ${privateLocation.label}`
        );
      }
    }
  }

  async createPolicyBulk(
    newPolicies: NewPackagePolicyWithId[],
    savedObjectsClient: SavedObjectsClientContract
  ) {
    const soClient = savedObjectsClient;
    const esClient = this.server.uptimeEsClient.baseESClient;
    if (soClient && esClient) {
      return await this.server.fleet.packagePolicyService.bulkCreate(
        soClient,
        esClient,
        newPolicies
      );
    }
  }

  async createPolicy(
    newPolicy: NewPackagePolicy,
    id: string,
    savedObjectsClient: SavedObjectsClientContract
  ) {
    const soClient = savedObjectsClient;
    const esClient = this.server.uptimeEsClient.baseESClient;
    if (soClient && esClient) {
      return await this.server.fleet.packagePolicyService.create(soClient, esClient, newPolicy, {
        id,
        overwrite: true,
      });
    }
  }

  async updatePolicy(
    updatedPolicy: NewPackagePolicy,
    id: string,
    savedObjectsClient: SavedObjectsClientContract
  ) {
    const soClient = savedObjectsClient;
    const esClient = this.server.uptimeEsClient.baseESClient;
    if (soClient && esClient) {
      return await this.server.fleet.packagePolicyService.update(
        soClient,
        esClient,
        id,
        updatedPolicy,
        {
          force: true,
        }
      );
    }
  }

  async getMonitor(id: string, savedObjectsClient: SavedObjectsClientContract) {
    try {
      return await this.server.fleet.packagePolicyService.get(savedObjectsClient!, id);
    } catch (e) {
      this.server.logger.debug(e);
      return null;
    }
  }

  async deleteMonitors(
    configs: HeartbeatConfig[],
    request: KibanaRequest,
    savedObjectsClient: SavedObjectsClientContract,
    spaceId: string
  ) {
    const soClient = savedObjectsClient;
    const esClient = this.server.uptimeEsClient.baseESClient;

    const allPrivateLocations: PrivateLocation[] = await getSyntheticsPrivateLocations(soClient);

    if (soClient && esClient) {
      const policyIdsToDelete = [];
      for (const config of configs) {
        const { locations } = config;

        const monitorPrivateLocations = locations.filter((loc) => !loc.isServiceManaged);

        for (const privateLocation of monitorPrivateLocations) {
          const location = allPrivateLocations?.find((loc) => loc.id === privateLocation.id);
          if (location) {
            await this.checkPermissions(
              request,
              `Unable to delete Synthetics package policy for monitor ${
                config[ConfigKey.NAME]
              }. Fleet write permissions are needed to use Synthetics private locations.`
            );
            try {
              policyIdsToDelete.push(this.getPolicyId(config, location, spaceId));
            } catch (e) {
              this.server.logger.error(e);
              throw new Error(
                `Unable to delete Synthetics package policy for monitor ${
                  config[ConfigKey.NAME]
                } with private location ${location.label}`
              );
            }
          }
        }
      }
      if (policyIdsToDelete.length > 0) {
        await this.checkPermissions(
          request,
          `Unable to delete Synthetics package policy for monitor. Fleet write permissions are needed to use Synthetics private locations.`
        );
        await this.server.fleet.packagePolicyService.delete(soClient, esClient, policyIdsToDelete, {
          force: true,
        });
      }
    }
  }

  async getAgentPolicies() {
    const agentPolicies = await this.server.fleet.agentPolicyService.list(
      this.server.savedObjectsClient!,
      {
        page: 1,
        perPage: 10000,
      }
    );

    return agentPolicies.items;
  }
}
