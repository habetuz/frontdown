import { CronJob } from 'cron';
import env from './env';

const backup = () => {
  console.log('Starting backup...');
};

CronJob.from({
  cronTime: env.CRON_SCHEDULE,
  onTick: backup,
  start: true,
  timeZone: env.TZ,
});

void backup();
