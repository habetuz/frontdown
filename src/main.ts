import { CronJob } from 'cron';
import env from './env';
import { create_postgres_backup } from './postgres';
import { execa } from 'execa';

const backup = async () => {
  console.info('Starting backup...');
  console.info('Checking repository...');
  const repoExists = await new Promise((resolve) => {
    execa`borg info ${env.BACKUP_REPOSITORY}`
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });

  if (!repoExists) {
    console.log('Creating Borg repository...');
    await execa({
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSWORD,
      },
    })`borg init --encryption=repokey ${env.BACKUP_REPOSITORY}`;
  }

  console.info('Creating postgres backup...');
  await create_postgres_backup();

  console.info('Backing up data...');
  await execa({
    env: {
      BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSWORD,
    },
    stdout: 'inherit',
    stderr: 'inherit',
  })`borg create --progress --stats --compression lz4 ${env.BACKUP_REPOSITORY}::'{now:%Y-%m-%d_%H:%M:%S}' ${env.BACKUP_DATA}`;
};

CronJob.from({
  cronTime: env.CRON_SCHEDULE,
  onTick: backup,
  start: true,
  timeZone: env.TZ,
});

void backup();
