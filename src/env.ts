import { parse } from '@zodyac/env';
import { z } from 'zod';

const envSchema = z.object({
  RCLONE_CONF_FILE: z.string().default('/config/rclone.conf'),
  RCLONE_REMOTE: z.string(),

  TZ: z.string().default('UTC'),
  CRON_SCHEDULE: z.string().default('0 0 * * *'),

  BACKUP_DATA: z.string().default('/data'),
  BACKUP_REPOSITORY: z.string().default('/repo'),
  BACKUP_REPOSITORY_PASSWORD: z.string().optional(),

  POSTGRES_USER: z.string(),
});

const env = parse(envSchema);
export default env;
