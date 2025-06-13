# FRONTDOWN - Personalized backup solution

This is my personal backup solution for my docker landscape using borg.

14 daily, 8 weekly, 24 monthly and 4 yearly backups are kept.

## Volumes

| Path                 | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| /config/known_hosts  | known_hosts file used to authenticate the hetzner storage box ssh    |
| /config/ssh_key      | ssh key to connect to the hetzner storage box                        |
| /repo                | Local borg repository                                                |
| /data                | Folder to be backed up                                               |
| /var/run/docker.sock | The docker socket used to stop services and create the database dump |

## Environment variables

| Variable                     | Default     | Description                                                           |
| ---------------------------- | ----------- | --------------------------------------------------------------------- |
| TZ                           | UTC         | Timezone to be used for cronjobs etc.                                 |
| CRON_SCHEDULE                | `0 0 * * *` | Backup schedule                                                       |
| BACKUP_REPOSITORY_PASSPHRASE | -           | Passphrase of the borg repository                                     |
| BACKUP_REPOSITORY_OFFSITE    | ./repo      | Path where the borg repository gets stored in the hetzner storage box |
| POSTGRES_USER                | admin       | The user to be used when executing `pg_dumpall`                       |
| POSTGRES_CONTAINER_NAME      | postgres    | The container name of the postgres instance to backup                 |
| OFFSITE_SSH_USER             | -           | The user to connect to the hetzner storage box with                   |
| CONTAINERS                   | -           | Comma seperated list of containers to stop before the backup          |
