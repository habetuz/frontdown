import { CronJob } from 'cron';
import env from './env';

const backup = async () => {};

CronJob.from({
  cronTime: env.CRON_SCHEDULE,
  onTick: backup,
  start: true,
  timeZone: env.TZ,
});

void backup();
