import Docker from 'dockerode';

const backup = async (docker: Docker) => {
  await docker.pull('curlimages/curl:latest');
  const container = await docker.createContainer({
    Image: 'curlimages/curl',
    Cmd: ['-XPOST', 'http://prometheus:9090/api/v1/admin/tsdb/snapshot'], // Replace placeholders
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
    stderr: false,
  });

  stream.pipe(process.stdout); // Show the output live

  // Wait for the container to finish
  await container.wait();

  console.log('Prometheus backup created');
};

export default { backup };
