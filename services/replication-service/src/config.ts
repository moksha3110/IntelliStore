import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'replication-service',
  port: loadServicePort('REPLICATION_SERVICE_PORT', 4004),
};
