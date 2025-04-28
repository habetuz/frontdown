import { CronJob } from 'cron';
import env from './env';
import { execa } from 'execa';
import Docker, { Container } from 'dockerode';
import logger from './logger';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import readline from 'node:readline';

const BORG_RSH = `ssh -i ${env.OFFSITE_SSH_KEY_FILE} -o StrictHostKeyChecking=no -o UserKnownHostsFile=${env.SSH_KNOWN_HOSTS_FILE}`;
const BORG_REPO_OFFSITE = `ssh://${env.OFFSITE_SSH_USER}@${env.OFFSITE_SSH_USER}.your-storagebox.de:23/${env.BACKUP_REPOSITORY_OFFSITE}`;

const formatDate = (date: Date): string => {
  const berlinDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const parts: Record<string, string> = {};
  berlinDateParts.forEach((part) => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  });

  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`;
};

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
    AttachStderr: true,
    AttachStdout: true,
    AttachStdin: false,
    Cmd: ['pg_dumpall', '--username', env.POSTGRES_USER],
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  await fsPromises.mkdir(`${env.BACKUP_DATA}/postgres`, { recursive: true });
  const fileStream = fs.createWriteStream(
    `${env.BACKUP_DATA}/postgres/backup.sql`,
    { encoding: 'utf-8', flags: 'w' },
  );

  // Demultiplex the Docker stream to clean stdout/stderr
  docker.modem.demuxStream(stream, fileStream, process.stderr);

  // Wait for the stream to finish
  await new Promise<void>((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  logger.info('Postgres backup created');
};

const backupLocal = async () => {
  const exec = execa(
    'borg',
    [
      'create',
      '--stats',
      '--progress',
      '--compression',
      'lz4',
      `::${formatDate(new Date())}`,
      env.BACKUP_DATA,
    ],
    {
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
        BORG_REPO: env.BACKUP_REPOSITORY_LOCAL,
      },
      stderr: 'pipe', // <-- make sure stderr is a stream
      stdout: 'ignore', // optional: ignore stdout if you only want stderr
    },
  );

  // Create a readline interface on stderr
  const rl = readline.createInterface({
    input: exec.stderr,
    crlfDelay: Infinity,
  });

  // Stream stderr lines as they arrive
  for await (const line of rl) {
    logger.info(`Local: ${line}`);
  }

  // Wait for the process to complete
  await exec;
  logger.info('Local backup complete');
};

const backupOffsite = async () => {
  const exec = execa(
    'borg',
    [
      'create',
      '--stats',
      '--progress',
      '--compression',
      'lz4',
      `::${formatDate(new Date())}`,
      env.BACKUP_DATA,
    ],
    {
      env: {
        BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
        BORG_REPO: BORG_REPO_OFFSITE,
        BORG_RSH: BORG_RSH,
      },
      stderr: 'pipe', // <-- make sure stderr is a stream
      stdout: 'ignore', // optional: ignore stdout if you only want stderr
    },
  );

  // Create a readline interface on stderr
  const rl = readline.createInterface({
    input: exec.stderr,
    crlfDelay: Infinity,
  });

  // Stream stderr lines as they arrive
  for await (const line of rl) {
    logger.info(`Offsite: ${line}`);
  }

  // Wait for the process to complete
  await exec;
  logger.info('Offsite backup complete');
};

const pruneLocal = async () => {
  const exec = execa({
    env: {
      BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
      BORG_REPO: env.BACKUP_REPOSITORY_LOCAL,
    },
  })`borg prune --list --keep-within ${env.BACKUP_DAYS_TO_KEEP}d`;
  const rl = readline.createInterface({
    input: exec.stderr,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    logger.info(`Local prune: ${line}`);
  }
  await exec;
  logger.info('Local prune complete');
};

const pruneOffsite = async () => {
  const exec = execa({
    env: {
      BORG_PASSPHRASE: env.BACKUP_REPOSITORY_PASSPHRASE,
      BORG_REPO: BORG_REPO_OFFSITE,
      BORG_RSH: BORG_RSH,
    },
  })`borg prune --list --keep-within ${env.BACKUP_DAYS_TO_KEEP}d`;
  const rl = readline.createInterface({
    input: exec.stderr,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    logger.info(`Offsite prune: ${line}`);
  }
  await exec;
  logger.info('Offsite prune complete');
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
  await Promise.all([backupLocal(), backupOffsite()]);

  logger.info('Starting containers and pruning old archives...');
  await Promise.all([
    startContainers(containers),
    pruneLocal(),
    pruneOffsite(),
  ]);

  logger.info('Backup job complete!');
};

CronJob.from({
  cronTime: env.CRON_SCHEDULE,
  onTick: backupJob,
  start: true,
  timeZone: env.TZ,
});

if (env.RUN_AFTER_STARTUP) {
  void backupJob();
}
