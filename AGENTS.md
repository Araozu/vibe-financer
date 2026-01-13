# Project Architecture: Layered Domain-Driven Design (Lite)

This project follows a simplified layered architecture to maintain separation of concerns without the overhead of full Clean Architecture ceremony (no mandatory interfaces or dependency injection containers).

## Layers

### 1. Domain Layer (`src/lib/domain/`)
- **Responsibility**: Core business logic, pure functions, and domain-specific types.
- **Rules**: 
    - Must be "pure" (side-effect free).
    - **No imports** from Infrastructure or Application layers.
    - Contains logic like budget calculations, transaction validation rules, and financial formatting.

### 2. Infrastructure Layer (`src/lib/infra/`)
- **Responsibility**: Technical implementation details and external systems.
- **Contents**:
    - `db/`: Drizzle schema and client initialization.
    - `repos/`: Database-specific queries (Repositories).
- **Rules**: 
    - This is the only place where Drizzle `db` or specific SQL queries should live.

### 3. Application Layer (`src/lib/application/`)
- **Responsibility**: Orchestration of use cases.
- **Rules**: 
    - The "glue" between Domain and Infrastructure.
    - Coordinates workflows (e.g., "Create Transaction" -> validate via Domain -> save via Infra Repo).
    - Does not contain complex business logic itself; it delegates to the Domain.

### 4. Presentation Layer (`src/routes/` & `src/lib/components/`)
- **Responsibility**: UI (Svelte components) and SvelteKit entry points (+page.server.ts).
- **Rules**: 
    - `+page.server.ts` loaders and actions should call Application services/functions.
    - UI components should be kept lean, focusing on display and user interaction.

---

## Directory Mapping
```text
src/lib/
  ├── domain/        # Business logic & Domain types
  ├── application/   # Use cases & Orchestration
  ├── infra/         # Persistence (Drizzle, Repos)
  └── components/    # UI (Presentation)
```

## UI

- Always prefer shadcn components.
- If a shadcn component is not available, install it: `bun x shadcn-svelte@latest add card -y`
- When installing, use the `-y` flag for autoinstall
- Always prefer shadcn styles, variants, etc; rather than manual tailwind classes

