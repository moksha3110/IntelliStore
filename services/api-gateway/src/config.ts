import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'api-gateway',
  port: loadServicePort('API_GATEWAY_PORT', 4000),
};
