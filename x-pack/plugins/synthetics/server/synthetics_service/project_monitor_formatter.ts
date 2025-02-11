/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { Subject } from 'rxjs';
import { isEqual } from 'lodash';
import { KibanaRequest } from '@kbn/core/server';
import {
  SavedObjectsUpdateResponse,
  SavedObjectsClientContract,
  SavedObjectsFindResult,
} from '@kbn/core/server';
import { EncryptedSavedObjectsClient } from '@kbn/encrypted-saved-objects-plugin/server';
import { syncNewMonitorBulk } from '../routes/monitor_cruds/bulk_cruds/add_monitor_bulk';
import { deleteMonitorBulk } from '../routes/monitor_cruds/bulk_cruds/delete_monitor_bulk';
import { SyntheticsMonitorClient } from './synthetics_monitor/synthetics_monitor_client';
import {
  BrowserFields,
  ConfigKey,
  SyntheticsMonitorWithSecrets,
  EncryptedSyntheticsMonitor,
  ServiceLocationErrors,
  ProjectBrowserMonitor,
  Locations,
  SyntheticsMonitor,
  MonitorFields,
  PrivateLocation,
} from '../../common/runtime_types';
import {
  syntheticsMonitorType,
  syntheticsMonitor,
} from '../legacy_uptime/lib/saved_objects/synthetics_monitor';
import { normalizeProjectMonitor } from './normalizers/browser';
import { formatSecrets, normalizeSecrets } from './utils/secrets';
import { syncEditedMonitor } from '../routes/monitor_cruds/edit_monitor';
import { validateProjectMonitor } from '../routes/monitor_cruds/monitor_validation';
import type { UptimeServerSetup } from '../legacy_uptime/lib/adapters/framework';

interface StaleMonitor {
  stale: boolean;
  journeyId: string;
  savedObjectId: string;
}
type StaleMonitorMap = Record<string, StaleMonitor>;
type FailedMonitors = Array<{ id?: string; reason: string; details: string; payload?: object }>;

export const INSUFFICIENT_FLEET_PERMISSIONS =
  'Insufficient permissions. In order to configure private locations, you must have Fleet and Integrations write permissions. To resolve, please generate a new API key with a user who has Fleet and Integrations write permissions.';

export class ProjectMonitorFormatter {
  private projectId: string;
  private spaceId: string;
  private keepStale: boolean;
  private locations: Locations;
  private privateLocations: PrivateLocation[];
  private savedObjectsClient: SavedObjectsClientContract;
  private encryptedSavedObjectsClient: EncryptedSavedObjectsClient;
  private staleMonitorsMap: StaleMonitorMap = {};
  private monitors: ProjectBrowserMonitor[] = [];
  public createdMonitors: string[] = [];
  public deletedMonitors: string[] = [];
  public updatedMonitors: string[] = [];
  public staleMonitors: string[] = [];
  public failedMonitors: FailedMonitors = [];
  public failedStaleMonitors: FailedMonitors = [];
  private server: UptimeServerSetup;
  private projectFilter: string;
  private syntheticsMonitorClient: SyntheticsMonitorClient;
  private request: KibanaRequest;
  private subject?: Subject<unknown>;

  private writeIntegrationPoliciesPermissions?: boolean;

  constructor({
    locations,
    privateLocations,
    keepStale,
    savedObjectsClient,
    encryptedSavedObjectsClient,
    projectId,
    spaceId,
    monitors,
    server,
    syntheticsMonitorClient,
    request,
    subject,
  }: {
    locations: Locations;
    privateLocations: PrivateLocation[];
    keepStale: boolean;
    savedObjectsClient: SavedObjectsClientContract;
    encryptedSavedObjectsClient: EncryptedSavedObjectsClient;
    projectId: string;
    spaceId: string;
    monitors: ProjectBrowserMonitor[];
    server: UptimeServerSetup;
    syntheticsMonitorClient: SyntheticsMonitorClient;
    request: KibanaRequest;
    subject?: Subject<unknown>;
  }) {
    this.projectId = projectId;
    this.spaceId = spaceId;
    this.locations = locations;
    this.privateLocations = privateLocations;
    this.keepStale = keepStale;
    this.savedObjectsClient = savedObjectsClient;
    this.encryptedSavedObjectsClient = encryptedSavedObjectsClient;
    this.syntheticsMonitorClient = syntheticsMonitorClient;
    this.monitors = monitors;
    this.server = server;
    this.projectFilter = `${syntheticsMonitorType}.attributes.${ConfigKey.PROJECT_ID}: "${this.projectId}"`;
    this.request = request;
    this.subject = subject;
  }

  public configureAllProjectMonitors = async () => {
    const existingMonitors = await this.getProjectMonitorsForProject();

    this.staleMonitorsMap = await this.getStaleMonitorsMap(existingMonitors);

    const normalizedNewMonitors: BrowserFields[] = [];
    const normalizedUpdateMonitors: BrowserFields[] = [];

    for (const monitor of this.monitors) {
      const previousMonitor = existingMonitors.find(
        (monitorObj) =>
          (monitorObj.attributes as BrowserFields)[ConfigKey.JOURNEY_ID] === monitor.id
      );

      const normM = await this.validateProjectMonitor({
        monitor,
      });
      if (normM) {
        if (previousMonitor) {
          this.updatedMonitors.push(monitor.id);
          if (this.staleMonitorsMap[monitor.id]) {
            this.staleMonitorsMap[monitor.id].stale = false;
          }
          normalizedUpdateMonitors.push(normM);
        } else {
          normalizedNewMonitors.push(normM);
        }
      }
    }

    await this.createMonitorsBulk(normalizedNewMonitors);

    await this.updateMonitorBulk(normalizedUpdateMonitors);

    await this.handleStaleMonitors();
  };

  validatePermissions = async ({ monitor }: { monitor: ProjectBrowserMonitor }) => {
    if (this.writeIntegrationPoliciesPermissions || (monitor.privateLocations ?? []).length === 0) {
      return;
    }
    const {
      integrations: { writeIntegrationPolicies },
    } = await this.server.fleet.authz.fromRequest(this.request);

    this.writeIntegrationPoliciesPermissions = writeIntegrationPolicies;

    if (!writeIntegrationPolicies) {
      throw new Error(INSUFFICIENT_FLEET_PERMISSIONS);
    }
  };

  validateProjectMonitor = async ({ monitor }: { monitor: ProjectBrowserMonitor }) => {
    try {
      await this.validatePermissions({ monitor });

      const normalizedMonitor = normalizeProjectMonitor({
        monitor,
        locations: this.locations,
        privateLocations: this.privateLocations,
        projectId: this.projectId,
        namespace: this.spaceId,
      });

      const validationResult = validateProjectMonitor(monitor, this.projectId);

      if (!validationResult.valid) {
        const { reason: message, details, payload } = validationResult;
        this.failedMonitors.push({
          id: monitor.id,
          reason: message,
          details,
          payload,
        });
        if (this.staleMonitorsMap[monitor.id]) {
          this.staleMonitorsMap[monitor.id].stale = false;
        }
        return null;
      }

      return normalizedMonitor;
    } catch (e) {
      this.server.logger.error(e);
      this.failedMonitors.push({
        id: monitor.id,
        reason: 'Failed to create or update monitor',
        details: e.message,
        payload: monitor,
      });
      this.handleStreamingMessage({ message: `${monitor.id}: failed to create or update monitor` });
      if (this.staleMonitorsMap[monitor.id]) {
        this.staleMonitorsMap[monitor.id].stale = false;
      }
    }
  };

  private getStaleMonitorsMap = async (
    existingMonitors: Array<SavedObjectsFindResult<EncryptedSyntheticsMonitor>>
  ): Promise<StaleMonitorMap> => {
    const staleMonitors: StaleMonitorMap = {};

    existingMonitors.forEach((savedObject) => {
      const journeyId = (savedObject.attributes as BrowserFields)[ConfigKey.JOURNEY_ID];
      if (journeyId) {
        staleMonitors[journeyId] = {
          stale: true,
          savedObjectId: savedObject.id,
          journeyId,
        };
      }
    });

    return staleMonitors;
  };

  public getProjectMonitorsForProject = async () => {
    const finder = this.savedObjectsClient.createPointInTimeFinder({
      type: syntheticsMonitorType,
      perPage: 1000,
      filter: this.projectFilter,
    });

    const hits: Array<SavedObjectsFindResult<EncryptedSyntheticsMonitor>> = [];
    for await (const result of finder.find()) {
      hits.push(
        ...(result.saved_objects as Array<SavedObjectsFindResult<EncryptedSyntheticsMonitor>>)
      );
    }

    await finder.close();

    return hits;
  };

  private getExistingMonitor = async (
    journeyId: string
  ): Promise<SavedObjectsFindResult<EncryptedSyntheticsMonitor>> => {
    const filter = `${this.projectFilter} AND ${syntheticsMonitorType}.attributes.${ConfigKey.JOURNEY_ID}: "${journeyId}"`;
    const { saved_objects: savedObjects } =
      await this.savedObjectsClient.find<EncryptedSyntheticsMonitor>({
        type: syntheticsMonitorType,
        perPage: 1,
        filter,
      });
    return savedObjects?.[0];
  };

  private createMonitorsBulk = async (monitors: BrowserFields[]) => {
    try {
      if (monitors.length > 0) {
        const { newMonitors } = await syncNewMonitorBulk({
          normalizedMonitors: monitors,
          server: this.server,
          syntheticsMonitorClient: this.syntheticsMonitorClient,
          soClient: this.savedObjectsClient,
          request: this.request,
          privateLocations: this.privateLocations,
          spaceId: this.spaceId,
        });

        if (newMonitors && newMonitors.length === monitors.length) {
          this.createdMonitors.push(...monitors.map((monitor) => monitor[ConfigKey.JOURNEY_ID]!));
          this.handleStreamingMessage({
            message: `${monitors.length} monitor${
              monitors.length > 1 ? 's' : ''
            } created successfully.`,
          });
        } else {
          this.failedMonitors.push({
            reason: `Failed to create ${monitors.length} monitors`,
            details: 'Failed to create monitors',
            payload: monitors,
          });
          this.handleStreamingMessage({
            message: `Failed to create ${monitors.length} monitors`,
          });
        }
      }
    } catch (e) {
      this.server.logger.error(e);
      this.failedMonitors.push({
        reason: `Failed to create ${monitors.length} monitors`,
        details: e.message,
        payload: monitors,
      });
      this.handleStreamingMessage({
        message: `Failed to create ${monitors.length} monitors`,
      });
    }
  };

  private updateMonitorBulk = async (monitors: BrowserFields[]) => {
    try {
      for (const monitor of monitors) {
        const previousMonitor = await this.getExistingMonitor(monitor[ConfigKey.JOURNEY_ID]!);
        await this.updateMonitor(previousMonitor, monitor);
      }

      if (monitors.length > 0) {
        this.handleStreamingMessage({
          message: `${monitors.length} monitor${
            monitors.length > 1 ? 's' : ''
          } updated successfully.`,
        });
      }
    } catch (e) {
      this.server.logger.error(e);
      this.failedMonitors.push({
        reason: 'Failed to update monitors',
        details: e.message,
        payload: monitors,
      });
      this.handleStreamingMessage({
        message: `Failed to update ${monitors.length} monitors`,
      });
    }
  };

  private updateMonitor = async (
    previousMonitor: SavedObjectsFindResult<EncryptedSyntheticsMonitor>,
    normalizedMonitor: BrowserFields
  ): Promise<{
    editedMonitor: SavedObjectsUpdateResponse<EncryptedSyntheticsMonitor>;
    errors: ServiceLocationErrors;
  }> => {
    const decryptedPreviousMonitor =
      await this.encryptedSavedObjectsClient.getDecryptedAsInternalUser<SyntheticsMonitorWithSecrets>(
        syntheticsMonitor.name,
        previousMonitor.id,
        {
          namespace: previousMonitor.namespaces?.[0],
        }
      );
    const {
      attributes: { [ConfigKey.REVISION]: _, ...normalizedPreviousMonitorAttributes },
    } = normalizeSecrets(decryptedPreviousMonitor);
    const hasMonitorBeenEdited = !isEqual(normalizedMonitor, normalizedPreviousMonitorAttributes);

    if (hasMonitorBeenEdited) {
      const monitorWithRevision = formatSecrets({
        ...normalizedPreviousMonitorAttributes,
        ...normalizedMonitor,
        revision: (previousMonitor.attributes[ConfigKey.REVISION] || 0) + 1,
      });

      const { editedMonitor } = await syncEditedMonitor({
        normalizedMonitor,
        monitorWithRevision,
        previousMonitor,
        decryptedPreviousMonitor,
        server: this.server,
        syntheticsMonitorClient: this.syntheticsMonitorClient,
        savedObjectsClient: this.savedObjectsClient,
        request: this.request,
        spaceId: this.spaceId,
      });
      return { editedMonitor, errors: [] };
    }

    return { errors: [], editedMonitor: decryptedPreviousMonitor };
  };

  private handleStaleMonitors = async () => {
    try {
      const staleMonitorsList = Object.values(this.staleMonitorsMap).filter(
        (monitor) => monitor.stale === true
      );

      const encryptedMonitors = await this.savedObjectsClient.bulkGet<SyntheticsMonitor>(
        staleMonitorsList.map((staleMonitor) => ({
          id: staleMonitor.savedObjectId,
          type: syntheticsMonitorType,
        }))
      );

      let monitors = encryptedMonitors.saved_objects;

      const hasPrivateMonitor = monitors.some((monitor) =>
        monitor.attributes.locations.some((location) => !location.isServiceManaged)
      );

      if (hasPrivateMonitor) {
        const {
          integrations: { writeIntegrationPolicies },
        } = await this.server.fleet.authz.fromRequest(this.request);
        if (!writeIntegrationPolicies) {
          monitors = monitors.filter((monitor) => {
            const hasPrivateLocation = monitor.attributes.locations.some(
              (location) => !location.isServiceManaged
            );
            if (hasPrivateLocation) {
              const journeyId = (monitor.attributes as MonitorFields)[ConfigKey.JOURNEY_ID]!;
              const monitorName = (monitor.attributes as MonitorFields)[ConfigKey.NAME]!;
              this.handleStreamingMessage({
                message: `Monitor ${journeyId} could not be deleted`,
              });
              this.failedStaleMonitors.push({
                id: journeyId,
                reason: 'Failed to delete stale monitor',
                details: `Unable to delete Synthetics package policy for monitor ${monitorName}. Fleet write permissions are needed to use Synthetics private locations.`,
              });
            }
            return !hasPrivateLocation;
          });
        }
      }

      const chunkSize = 100;
      for (let i = 0; i < monitors.length; i += chunkSize) {
        const chunkMonitors = monitors.slice(i, i + chunkSize);
        try {
          if (!this.keepStale) {
            await deleteMonitorBulk({
              monitors: chunkMonitors,
              savedObjectsClient: this.savedObjectsClient,
              server: this.server,
              syntheticsMonitorClient: this.syntheticsMonitorClient,
              request: this.request,
            });

            for (const sm of chunkMonitors) {
              const journeyId = (sm.attributes as MonitorFields)[ConfigKey.JOURNEY_ID]!;

              this.deletedMonitors.push(journeyId);
              this.handleStreamingMessage({
                message: `Monitor ${journeyId} deleted successfully`,
              });
            }
          } else {
            chunkMonitors.forEach((sm) => {
              const journeyId = (sm.attributes as MonitorFields)[ConfigKey.JOURNEY_ID]!;
              this.staleMonitors.push(journeyId);
            });
          }
        } catch (e) {
          chunkMonitors.forEach((sm) => {
            const journeyId = (sm.attributes as MonitorFields)[ConfigKey.JOURNEY_ID]!;

            this.handleStreamingMessage({
              message: `Monitor ${journeyId} could not be deleted`,
            });
            this.failedStaleMonitors.push({
              id: journeyId,
              reason: 'Failed to delete stale monitor',
              details: e.message,
              payload: staleMonitorsList.find(
                (staleMonitor) => staleMonitor.savedObjectId === sm.id
              ),
            });
          });
          this.server.logger.error(e);
        }
      }
    } catch (e) {
      this.server.logger.error(e);
    }
  };

  private handleStreamingMessage = ({ message }: { message: string }) => {
    if (this.subject) {
      this.subject?.next(message);
    }
  };
}
