import Docker from 'dockerode';
import ServiceHandler from './ServiceHandler';
import env from '../env';
import fs from 'fs';

export default class PostgresHandler extends ServiceHandler {
  private docker: Docker = new Docker();
  private containerInfo: Docker.ContainerInfo | undefined = undefined;

  constructor(data_location: string) {
    super('Postgres', data_location);
  }

  async stopService(): Promise<void> {
    // const info = await this.docker.listContainers();
    // if (!info.some((container) => container.Names[0] === '/postgres')) {
    //   throw new Error('No running postgres container found');
    // }
    // this.containerInfo = info.filter((container) => {
    //   return container.Names[0] === '/postgres';
    // })[0];
    // const containerInstance = this.docker.getContainer(this.containerInfo.Id);
    // await containerInstance.stop();
  }

  async startService(): Promise<void> {
    // if (!this.containerInfo) {
    //   throw new Error(
    //     'No container info available. Please stop the service first.',
    //   );
    // }
    // const containerInstance = this.docker.getContainer(this.containerInfo.Id);
    // await containerInstance.start();
  }

  async gatherData(): Promise<void> {
    if (!this.containerInfo) {
      throw new Error(
        'No container info available. Please stop the service first.',
      );
    }

    const exec = await this.docker.getContainer(this.containerInfo.Id).exec({
      Cmd: ['pg_dumpall', '--username', env.POSTGRES_USER],
    });

    const inputStream = await exec.start({});

    const outputStream = fs.createWriteStream(
      `${env.BACKUP_BASE_DIR}/postgres/backup.sql`,
    );
    inputStream.pipe(outputStream);

    await new Promise<void>((resolve, reject) => {
      outputStream.on('finish', resolve);
      outputStream.on('error', reject);
    });
  }
}
