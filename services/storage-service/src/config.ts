import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'storage-service',
  port: loadServicePort('STORAGE_SERVICE_PORT', 4003),
};
