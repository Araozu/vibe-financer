#!/bin/sh
set -eu pipefail

# Run migrations
./node_modules/.bin/drizzle-kit migrate

# Run the application
bun --bun ./build/index.js
