import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'auth-service',
  port: loadServicePort('AUTH_SERVICE_PORT', 4001),
};
