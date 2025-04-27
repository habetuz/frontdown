import pino from 'pino';

const logger = pino({
  level: 'debug',
  transport: undefined,
});

export default logger;
