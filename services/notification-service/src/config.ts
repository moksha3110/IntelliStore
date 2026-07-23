import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'notification-service',
  port: loadServicePort('NOTIFICATION_SERVICE_PORT', 4006),
};
