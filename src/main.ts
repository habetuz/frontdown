import { CronJob } from 'cron';
import env from './env';
import { execa } from 'execa';
import Docker, { Container } from 'dockerode';
import logger from './logger';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

const BORG_RSH = `ssh -i ${env.OFFSITE_SSH_KEY_FILE} -o StrictHostKeyChecking=no -o UserKnownHostsFile=${env.SSH_KNOWN_HOSTS_FILE}`;
const BORG_REPO_OFFSITE = `ssh://${env.OFFSITE_SSH_USER}@${env.OFFSITE_SSH_USER}.your-storagebox.de:23/${env.BACKUP_REPOSITORY_OFFSITE}`;

const stopContainers = async (docker: Docker): Promise<Container[]> => {
  const runningContainers = await docker.listContainers();

  const containers = await Promise.all(
    env.CONTAINERS.map((containerName) => {
      const filtered = runningContainers.filter(
        (container) => container.Names[0] === `/${containerName}`,
      );

      if (filtered.length === 0) {
        throw new Error(`Container ${containerName} not found`);
      }

      return filtered[0];
    }).map(async (containerInfo) => {
      const containerInstance = docker.getContainer(containerInfo.Id);
      if (
        containerInfo.State !== 'running' &&
        containerInfo.State !== 'paused'
      ) {
        throw new Error(
          `Container ${containerInfo.Names[0]} is not running or paused. It is ${containerInfo.State}`,
        );
      } else if (containerInfo.State === 'running') {
        await containerInstance.pause();
      }

      return containerInstance;
    }),
  );

  logger.info('Containers stopped');
  return containers;
};

const startContainers = async (containers: Container[]) => {
  await Promise.all(containers.map((container) => container.unpause()));
  logger.info('Containers started');
};

const ensureRepoExistence = async () => {
  const offsiteCheck = new Promise<boolean>((resolve) => {
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

  const localCheck = new Promise<boolean>((resolve) => {
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
  logger.info('Repository check complete');
};

const createPostgresBackup = async (docker: Docker) => {
  const filtered = (await docker.listContainers()).filter(
    (container) => container.Names[0] === `/${env.POSTGRES_CONTAINER_NAME}`,
  );

  if (filtered.length === 0) {
    throw new Error('No running postgres container found');
  }

  const containerInfo = filtered[0];
  const containerInstance = docker.getContainer(containerInfo.Id);
  const exec = await containerInstance.exec({
    Cmd: ['pg_dumpall', '--username', env.POSTGRES_USER],
  });
  const stream = await exec.start({});

  await fsPromises.mkdir(`${env.BACKUP_DATA}/postgres`, { recursive: true });
  const fileStream = fs.createWriteStream(
    `${env.BACKUP_DATA}/postgres/backup.sql`,
  );
  stream.pipe(fileStream);
  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  logger.info('Postgres backup created');
};

const backupJob = async () => {
  const docker = new Docker();

  logger.info('Starting backup...');

  const [_, containers] = await Promise.all([
    ensureRepoExistence(),
    stopContainers(docker),
    createPostgresBackup(docker),
  ]);
  logger.info('Prerequisites complete');
  logger.info('Backing up data...');

  logger.info('Starting containers...');
  await startContainers(containers);
  logger.info('Backup job complete!');
};

CronJob.from({
  cronTime: env.CRON_SCHEDULE,
  onTick: backupJob,
  start: true,
  timeZone: env.TZ,
});

void backupJob();
