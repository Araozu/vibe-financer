# Vibe Financer

Requires Node.js 26, pnpm 12.11.2, and PostgreSQL. The Node version is recorded in `.nvmrc`, and the pnpm version is pinned in `package.json`.

## Developing

```sh
nvm install
nvm use
pnpm install --frozen-lockfile
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string, then run:

```sh
pnpm run db:migrate
pnpm run dev
```

The development server runs on port 5124.

## Checking and building

```sh
pnpm run check
pnpm run build
```

Use `pnpm run preview` to preview the build locally.

## Production

```sh
pnpm run build
pnpm start
```

Startup applies database migrations, then runs the SvelteKit Node server on port 3000. `DATABASE_URL` can be supplied through the environment or a local `.env` file. Set `ORIGIN` to the public application URL when running behind a reverse proxy.

To build the production image:

```sh
docker build -f +devops/docker/Dockerfile -t vibe-financer .
```

The image includes production dependencies and migrations, and runs as the non-root `node` user.
