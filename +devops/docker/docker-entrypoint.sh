#!/bin/sh
set -eu pipefail

# Run migrations
bun run db:migrate

# Run the application
bun --bun ./build/index.js
