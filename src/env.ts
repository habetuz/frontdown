//import { parse } from '@zodyac/env';
import { z } from 'zod';
import logger from './logger';
import { fromError } from 'zod-validation-error';

const envSchema = z.object({
  TZ: z.string().default('UTC'),
  CRON_SCHEDULE: z.string().default('0 0 * * *'),

  BACKUP_DATA: z.string().default('/data'),
  BACKUP_REPOSITORY_OFFSITE: z.string().default('./repo'),
  BACKUP_REPOSITORY_LOCAL: z.string().default('/repo'),
  BACKUP_REPOSITORY_PASSPHRASE: z.string(),

  OFFSITE_SSH_KEY_FILE: z.string().default('/config/ssh_key'),
  OFFSITE_SSH_USER: z.string(),
  SSH_KNOWN_HOSTS_FILE: z.string().default('/config/known_hosts'),

  POSTGRES_USER: z.string().default('admin'),
  POSTGRES_CONTAINER_NAME: z.string().default('postgres'),

  CONTAINERS: z.string().transform((val) => {
    const containers = val.split(',').map((container) => container.trim());
    if (containers[0] === '') {
      return [];
    } else {
      return containers;
    }
  }),
});

let env: z.infer<typeof envSchema>;
try {
  //env = parse(envSchema);
  env = envSchema.parse(process.env)
} catch (err) {
  const validationError = fromError(err);
  logger.error(validationError.toString());
  process.exit(1);
}
export default env;
