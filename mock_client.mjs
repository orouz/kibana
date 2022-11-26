import { Client } from '@elastic/elasticsearch';
import fs from 'fs';
import Chance from 'chance';

const chance = new Chance();

const client = new Client({
  // node: 'http://localhost:9200', // es
  node: 'http://localhost:9220', // FTR
  // node: 'https://localhost:9200', // stack
  auth: { username: 'elastic', password: 'changeme' },
  tls: {
    // ca: fs.readFileSync('/Users/orouz/.elastic-package/profiles/default/certs/kibana/cert.pem'),
    rejectUnauthorized: false,
  },
});

const index = 'logs-cloud_security_posture.findings_latest-default';
// const latest_index = 'logs-cloud_security_posture.findings_latest-*';

const createFindings = ({ failed, passed }) => {
  const ids = chance.unique(chance.guid, failed + passed);

  const a = Array.from({ length: failed }, (_, i) => ({
    resource: {
      id: ids[i],
      name: `Resource ${i}`,
    },
    result: {
      evaluation: 'failed',
    },
    rule: {
      benchmark: {
        id: 'cis_k8s',
        name: 'CIS Kubernetes V1.23',
        version: 'v1.0.0',
      },
      default_value: '',
      impact: '',
      name: `Rule ${i}`,
      rationale: '',
      remediation: '',
      section: 'Kubelet',
      tags: ['Kubernetes'],
      type: 'process',
    },
  }));

  const b = Array.from({ length: passed }, (_, i) => ({
    resource: {
      id: ids[i + failed],
      name: `Resource ${i + failed}`,
    },
    result: {
      evaluation: 'failed',
    },
    rule: {
      benchmark: {
        id: 'cis_k8s',
        name: 'CIS Kubernetes V1.23',
        version: 'v1.0.0',
      },
      default_value: '',
      impact: '',
      name: `Rule ${i + failed}`,
      rationale: '',
      remediation: '',
      section: 'Kubelet',
      tags: ['Kubernetes'],
      type: 'process',
    },
  }));

  return Promise.all(
    [...a, ...b].map((document) =>
      client.index({
        index,
        document: {
          '@timestamp': '2022-01-19T21:07:20+00:00',
          ...document,
        },
      })
    )
  );
};

createFindings({ passed: 5, failed: 6 })
  .then((r) => console.log('Done', r))
  .catch((err) => {
    console.log('Failed', err.message);
  });
