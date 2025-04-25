import { CronJob } from 'cron';
import env from './env';
import { execa } from 'execa';

const BORG_RSH = `ssh -i ${env.OFFSITE_SSH_KEY_FILE} -o StrictHostKeyChecking=no -o UserKnownHostsFile=${env.SSH_KNOWN_HOSTS_FILE}`;
const BORG_REPO_OFFSITE = `ssh://${env.OFFSITE_SSH_USER}@${env.OFFSITE_SSH_USER}.your-storagebox.de:23/${env.BACKUP_REPOSITORY_OFFSITE}`;

const backup = async () => {
  console.info('Starting backup...');
  console.info('Checking repository...');
  const offsiteCheck = new Promise<boolean>((resolve, reject) => {
    execa({
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
        BORG_REPO: BORG_REPO_OFFSITE,
        BORG_RSH: BORG_RSH,
      },
    })`borg info`
      .then(() => resolve(true))
      .catch(() => resolve(false));
  }).then((exists) => {
    if (exists) return;

    return execa({
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
        BORG_REPO: BORG_REPO_OFFSITE,
        BORG_RSH: BORG_RSH,
      },
    })`borg init --encryption=repokey`;
  });

  const localCheck = new Promise<boolean>((resolve, reject) => {
    execa({
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
        BORG_REPO: env.BACKUP_REPOSITORY_LOCAL,
      },
    })`borg info`
      .then(() => resolve(true))
      .catch(() => resolve(false));
  }).then((exists) => {
    if (exists) return;

    return execa({
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
        BORG_REPO: env.BACKUP_REPOSITORY_LOCAL,
      },
    })`borg init --encryption=repokey`;
  });

  await Promise.all([offsiteCheck, localCheck]);
  console.log('Finished creation');

  // console.info('Creating postgres backup...');
  // await create_postgres_backup();

  // console.info('Backing up data...');
  // await execa({
  //   env: {
  //     BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
  //   },
  //   stdout: 'inherit',
  //   stderr: 'inherit',
  // })`borg create --progress --stats --compression lz4 ${env.BACKUP_REPOSITORY}::'{now:%Y-%m-%d_%H:%M:%S}' ${env.BACKUP_DATA}`;
};

CronJob.from({
  cronTime: env.CRON_SCHEDULE,
  onTick: backup,
  start: true,
  timeZone: env.TZ,
});

void backup();
