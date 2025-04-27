import { parse } from '@zodyac/env';
import { z } from 'zod';

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

console.log('Environment Variables:');
Object.entries(process.env).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

const testObjectSchema = z.object({
  test: z.string(),
  test1: z.string().default('test'),
});

const testObject = testObjectSchema.parse({ test: 'test' });
console.log('Test Object:', testObject);

const env = parse(envSchema);
export default env;
