import pino from 'pino';

const logger = pino({
  transport: undefined, // disable pretty print for Docker
});

export default logger;
