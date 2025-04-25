# FRONTDOWN - Personalized backup solution

This is my personal backup solution for my docker landscape using borg.

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
| OFFSITE_SSH_USER             | -           | The user to connect to the hetzner storage box with                   |
