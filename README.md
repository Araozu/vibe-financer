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
pnpm test
pnpm run lint
pnpm run build
```

Use `pnpm run preview` to preview the build locally.

Tests use Node's test runner with mocked persistence. Database access is disabled in the test harness,
so `pnpm test` does not require `DATABASE_URL` or connect to PostgreSQL. Linting checks files without
rewriting them; use `pnpm run format` when you want to apply formatting.

Passwords use salted Argon2id hashes with Node's asynchronous crypto API and the
[OWASP minimum configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)
(19 MiB memory, two passes, one lane). Existing SHA-256 passwords continue to work and are upgraded
after a successful login. Upgrades and password changes check the previous hash to avoid overwriting
a concurrent change. No database migration or password reset is required.

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
