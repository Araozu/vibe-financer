#!/bin/sh
set -eu

# Run migrations
bun i drizzle-kit
bun x drizzle-kit migrate

# Run the application
bun --bun ./build/index.js
