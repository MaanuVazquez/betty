#!/bin/sh
set -e
# Ensure the node user can read/write the database volume.
# Files placed in the volume externally (e.g. cookies.txt copied in as root)
# would otherwise be unwritable by the bot process.
chown -R node:node /app/database
exec su-exec node "$@"
