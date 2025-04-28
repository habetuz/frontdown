import Docker from 'dockerode';
import fsPromises from 'node:fs/promises';
import logger from './logger';

type SnapshotResponse = {
  status: string;
  data: {
    name: string;
  };
};
const backup = async (docker: Docker) => {
  await docker.pull('curlimages/curl:latest');
  const container = await docker.createContainer({
    Image: 'curlimages/curl',
    Cmd: ['-s', '-XPOST', 'http://prometheus:9090/api/v1/admin/tsdb/snapshot'],
    HostConfig: {
      NetworkMode: 'grafana_default', // Same network
      AutoRemove: true, // Equivalent to --rm
    },
  });

  // Start the container
  await container.start();

  // Optionally: attach to container logs
  const stream = await container.attach({
    stream: true,
    stdout: true,
    stderr: true,
  });

  // Collect the output as a string
  let output: string = '';
  stream.on('data', (chunk) => {
    logger.debug(chunk);
    output += String(chunk);
  });

  logger.debug(output);

  const outputJson: SnapshotResponse = JSON.parse(
    output,
  ) as unknown as SnapshotResponse;
  if (outputJson.status !== 'success') {
    throw new Error(
      `Failed to create snapshot:\n${JSON.stringify(outputJson)}`,
    );
  }

  // Define source and destination paths
  const sourceDir = `/prometheus/snapshots/${outputJson.data.name}`;
  const destDir = `/data/prometheus/`;

  await fsPromises.mkdir(destDir, { recursive: true });
  await fsPromises.cp(sourceDir, destDir, {
    recursive: true,
  });

  // Read the contents of the source directory
  const snapshots = await fsPromises.readdir('/prometheus/snapshots');

  // Delete all snapshots except the current one
  await Promise.all(
    snapshots.map(async (snapshot) => {
      if (snapshot !== outputJson.data.name) {
        const snapshotPath = `/prometheus/snapshots/${snapshot}`;
        await fsPromises.rm(snapshotPath, { recursive: true, force: true });
      }
    }),
  );

  // Wait for the container to finish
  await container.wait();

  console.log('Prometheus backup created');
};

export default { backup };
