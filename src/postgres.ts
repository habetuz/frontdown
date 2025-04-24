import Docker from 'dockerode';
import fs from 'node:fs';
import env from './env';

export const create_postgres_backup = async () => {
  const docker = new Docker();

  const info = await docker.listContainers();
  if (!info.some((container) => container.Names[0] === '/postgres')) {
    throw new Error('No running postgres container found');
  }
  const containerInfo = info.filter((container) => {
    return container.Names[0] === '/postgres';
  })[0];

  const containerInstance = docker.getContainer(containerInfo.Id);

  const exec = await containerInstance.exec({
    Cmd: ['pg_dumpall', '--username', env.POSTGRES_USER],
  });

  const inputStream = await exec.start({});

  const outputStream = fs.createWriteStream(
    `${env.BACKUP_DATA}/postgres/backup.sql`,
  );
  inputStream.pipe(outputStream);

  await new Promise<void>((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });
};
