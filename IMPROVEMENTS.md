# Event Sourcing & Projection Management — Suggested Improvements

The following improvements were identified during a thorough review of the event sourcing
implementation and projection management. They are documented here for future consideration
but were **not applied** as part of this review.

---

## 1. Multi-Stream Atomic Append for Transfers

**Location:** `src/lib/application/transaction/create-transaction.ts` (lines 108–123),
`delete-transaction.ts` (lines 106–153)

**Issue:** Transfer operations and transfer deletions append events to two separate account
streams in two independent database transactions. If the second append fails after the first
succeeds, the system enters an inconsistent state.

**Suggestion:** Refactor `eventStoreRepo.append()` to accept a transaction (`tx`) parameter
so both appends and their projection updates can be wrapped in a single PostgreSQL
transaction. This would provide true atomicity for multi-stream operations.

---

## 2. Audit Endpoint Fetches All Events Into Memory

**Location:** `src/routes/api/accounts/audit/+server.ts`

**Issue:** `getEventsByUser()` loads **all** events for a user into memory, then applies
`eventType` filtering and `limit` in JavaScript. For users with many events this is
inefficient.

**Suggestion:** Push the `eventType` filter and `LIMIT` clause down to the SQL query. Add a
new repo method like `getEventsByUserFiltered(userId, { eventType?, limit })` that performs
the filtering at the database level.

---

## 3. `getNetWorthOverTime` Has an N+1 Query Problem

**Location:** `src/lib/application/balance/balance-history.ts` (lines 99–140)

**Issue:** For each date point in the range, `getNetWorthAsOf()` is called individually.
Each call fetches all events for the user up to that date. For a 365-day range, this results
in 365 separate full-table scans.

**Suggestion:** Fetch all user events once (up to `endDate`), then iterate through dates
computing net worth from the pre-loaded event set. This reduces 365 queries to 1.

---

## 4. `listAccountsByUser` Fetches All Accounts Then Filters in Memory

**Location:** `src/lib/application/account/list-accounts.ts` (lines 15–19)

**Issue:** `listAccountsByUser()` calls `accountRepo.findAll()` then filters by `userId` in
JavaScript. This loads all accounts from all users into memory.

**Suggestion:** Add a `findByUserId(userId)` method to the account repo that includes a
`WHERE` clause for `userId`.

---

## 5. Missing `ConcurrencyError` Handling in `updateAccount`

**Location:** `src/lib/application/account/update-account.ts` (line 99)

**Issue:** The `append()` call uses `expectedVersion` for optimistic concurrency, but there
is no `try/catch` to handle `ConcurrencyError`. If a concurrent update occurs, the raw error
will propagate as a 500 Internal Server Error instead of a 409 Conflict.

**Suggestion:** Wrap the `append()` call in a try/catch that converts `ConcurrencyError` to
an HTTP 409 response, consistent with how `create-transaction.ts` and `edit-transaction.ts`
handle it.

---

## 6. Database URL Logged to Console

**Location:** `src/lib/infra/db/index.ts` (line 7)

**Issue:** `console.log('DATABASE_URL: ', env.DATABASE_URL)` logs the full database
connection string (which may contain credentials) to stdout on every server start.

**Suggestion:** Remove or redact this log statement. If connection logging is needed, log
only the host/database name without credentials.

---

## 7. Snapshot Date Hydration Is Incomplete

**Location:** `src/lib/infra/repos/event-store.repo.ts` (lines 434–441)

**Issue:** When loading a snapshot from JSONB, only `createdAt` and `updatedAt` are hydrated
back to `Date` objects. If the `AccountState` contains a nested `goal` with date fields
(e.g., `targetDate`, `createdAt`, `updatedAt`), those remain as strings.

**Suggestion:** Implement a recursive date hydration utility, or serialize/deserialize
snapshots using a format that preserves date types (e.g., using `superjson` or explicit
reviver functions).

---

## 8. Missing Input Validation in `editTransaction`

**Location:** `src/lib/application/transaction/edit-transaction.ts`

**Issue:** The `editTransaction` function does not validate that `updates.amount > 0` or
that `updates.type` is a valid transaction type. While the create flow validates amounts, the
edit flow does not.

**Suggestion:** Add validation at the top of `editTransaction()` to reject invalid amounts
and types before processing the edit.

---

## 9. Budget Projection Rebuild Is Missing

**Location:** `src/lib/application/account/rebuild-projections.ts`

**Issue:** The rebuild service reconstructs account and transaction projections from events,
but does not rebuild budget projections (e.g., `currentSpent` recalculation). After a
rebuild, budget `currentSpent` values may be stale.

**Suggestion:** Add budget projection rebuilding that replays expense transactions and
recalculates `currentSpent` for each budget based on the appropriate period window.

---

## 10. Goal and Currency Projection Rebuild Is Missing

**Location:** `src/lib/application/account/rebuild-projections.ts`

**Issue:** Similar to budgets, goal and currency projections are not rebuilt from events. If
goal or currency projections become inconsistent, there is no automated recovery path.

**Suggestion:** Extend the rebuild service to handle `GoalSet`, `GoalUpdated`,
`GoalRemoved`, `CurrencyCreated`, `CurrencyUpdated`, and `CurrencyDeleted` events.
