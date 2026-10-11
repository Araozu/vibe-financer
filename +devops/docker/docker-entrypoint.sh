#!/bin/sh
set -eu

# Run migrations
node --env-file-if-exists=.env ./node_modules/drizzle-kit/bin.cjs migrate

# Run the application
exec node --env-file-if-exists=.env ./build/index.js
