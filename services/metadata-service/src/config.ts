import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'metadata-service',
  port: loadServicePort('METADATA_SERVICE_PORT', 4002),
};
