#!/bin/sh
set -eu pipefail

# Run migrations
bun i drizzle-kit
bun x drizzle-kit migrate

# Run the application
bun --bun ./build/index.js
