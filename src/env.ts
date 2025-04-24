import { parse } from '@zodyac/env';
import { z } from 'zod';

const envSchema = z.object({
  RCLONE_CONF_FILE: z.string().default('/config/rclone.conf'),
  RCLONE_REMOTE: z.string(),
  TZ: z.string().default('UTC'),
  CRON_SCHEDULE: z.string().default('0 0 * * *'),
  BACKUP_BASE_DIR: z.string().default('/data'),
  POSTGRES_USER: z.string(),
});

const env = parse(envSchema);
export default env;
