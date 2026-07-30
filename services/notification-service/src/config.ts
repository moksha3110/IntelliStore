import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'notification-service',
  port: loadServicePort('NOTIFICATION_SERVICE_PORT', 4006),
  // This service's own queues, bound to the shared events exchange.
  chunkUploadedQueue: process.env.NOTIF_CHUNK_UPLOADED_QUEUE ?? 'notifications.chunk-uploaded',
  fileAccessedQueue: process.env.NOTIF_FILE_ACCESSED_QUEUE ?? 'notifications.file-accessed',
};
