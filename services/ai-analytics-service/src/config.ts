import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'ai-analytics-service',
  port: loadServicePort('AI_ANALYTICS_SERVICE_PORT', 4005),
};
