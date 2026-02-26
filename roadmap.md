# Vibe Financer — Roadmap

A personal finance app inspired by Firefly III, built with SvelteKit, Drizzle ORM, and a layered DDD-lite architecture.

_Last audited: 2026-02-26_

---

## ✅ What's Done

### Core Infrastructure

- [x] Layered architecture (Domain / Application / Infrastructure / Presentation)
- [x] PostgreSQL database with Drizzle ORM
- [x] Session-based authentication (login, signup, logout)
- [x] Docker deployment support
- [x] Modern UI with shadcn-svelte components
- [x] Event Sourcing Architecture — all state changes stored as immutable events

### Event Sourcing

- [x] Event store with versioning and optimistic concurrency
- [x] Domain events: AccountCreated, AccountUpdated, AccountDeleted, TransactionCreated, TransactionUpdated, TransactionDeleted, TransferCreated
- [x] Domain events: BudgetCreated, CurrencyCreated, GoalSet/Updated/Removed
- [x] Aggregate projections to rebuild state from events
- [x] Balance history with time-travel queries
- [x] Full audit trail for compliance
- [x] Net worth tracking over time
- [x] Read models (projections) for fast queries

### User Management

- [x] User registration and login
- [x] Session management with secure cookies
- [x] User profile settings (name, phone, date of birth, timezone)
- [x] Password change
- [x] Email change
- [x] Preferred currency setting

### Accounts

- [x] Create accounts with name, description, and color
- [x] Account types: Asset, Expense, Revenue, Liability, Savings
- [x] Multi-currency support (per-account currency)
- [x] Initial and current balance tracking
- [x] Account listing with detailed view
- [x] Balance history chart (month-to-date)
- [x] Historical balance queries — get balance at any point in time

### Transactions

- [x] Create transactions (expense, income, transfer)
- [x] Edit transactions (with event-sourced balance recalculation)
- [x] Delete transactions with balance rollback (soft delete + audit trail)
- [x] Transaction name, description, category, and payee
- [x] Transfers between accounts (same currency only)
- [x] Automatic balance updates on create/edit/delete
- [x] Recent transactions list with pagination
- [x] Transaction filtering by account
- [x] Balance snapshots — track balance before/after each transaction

### Budgets

- [x] Create and manage budgets (create + list)
- [x] Budget periods (monthly, weekly, yearly)
- [x] Budget limit tracking with progress indicators
- [x] Budget spend tracking from expense transactions
- [ ] Budget rollover to next period

### Savings Goals (Piggy Banks Lite)

- [x] Create savings goals with target amounts
- [x] Link savings goals to accounts
- [x] Track progress toward goals
- [x] Set optional goal target date
- [ ] Goal completion projections / forecasting

### Dashboard

- [x] Summary cards (total balance, monthly income, monthly expenses, savings rate)
- [x] Recent transactions table
- [x] Month-to-date balance chart (real data)
- [x] Quick transaction creation form
- [x] Account creation when none exist

### APIs

- [x] `GET /api/accounts/[id]/history` — account balance history and audit trail
- [x] `GET /api/accounts/net-worth` — net worth with time-travel and comparisons
- [x] `GET /api/accounts/audit` — global audit trail for all events
- [x] `GET /api/budgets` — list budgets
- [x] `POST|DELETE /api/goals` — set/remove savings goals
- [x] `GET /api/currencies` — list currencies
- [x] `DELETE /api/transactions/[id]` — delete transaction with rollback

---

## 🚧 Roadmap — Feature Parity with Firefly III

### Priority 1: Core Financial Features

#### Budgets

- [x] Create and manage budgets
- [x] Budget periods (monthly, weekly, yearly)
- [x] Budget limit tracking with progress indicators
- [x] Budget vs. actual spending (basic)
- [ ] Rollover unused budget to next period

#### Categories

- [ ] Category management (CRUD)
- [ ] Category groups/hierarchy
- [ ] Default categories for quick setup
- [ ] Category icons and colors
- [ ] Spending by category reports

#### Piggy Banks / Savings Goals

- [x] Create savings goals with target amounts
- [x] Link savings goals to accounts
- [x] Track progress toward goals
- [ ] Add/remove money from piggy banks (dedicated operation)
- [ ] Goal completion dates and projections

### Priority 2: Automation & Organization

#### Recurring Transactions

- [ ] Schedule recurring transactions (daily, weekly, monthly, yearly)
- [ ] Auto-create transactions on schedule
- [ ] Manage and edit recurring transaction templates
- [ ] Skip or pause recurring transactions
- [ ] Notifications for upcoming recurring transactions

#### Rules Engine

- [ ] Create rules for automatic transaction categorization
- [ ] Rule triggers (payee, amount, description patterns)
- [ ] Rule actions (set category, add tags, modify description)
- [ ] Rule priority and ordering
- [ ] Test rules against existing transactions

#### Tags

- [ ] Create and manage tags
- [ ] Apply multiple tags to transactions
- [ ] Filter and search by tags
- [ ] Tag-based reports

### Priority 3: Enhanced Transaction Management

#### Transaction Editing & Details

- [x] Edit existing transactions
- [x] Delete transactions with balance rollback
- [ ] Transaction detail view
- [ ] Duplicate transactions
- [ ] Transaction notes and internal notes

#### Split Transactions

- [ ] Split a single transaction into multiple categories
- [ ] Split by amount or percentage
- [ ] View splits in transaction detail

#### Attachments

- [ ] Upload receipts and documents to transactions
- [ ] Image preview and download
- [ ] File type restrictions and size limits

### Priority 4: Bills & Liabilities

#### Bills

- [ ] Track expected recurring expenses (rent, subscriptions, utilities)
- [ ] Bill due dates and payment tracking
- [ ] Mark bills as paid
- [ ] Bill reminders and notifications
- [ ] Expected vs. actual bill amounts

#### Liabilities & Debt Tracking

- [x] Liability account type support
- [ ] Track loans, credit cards, mortgages (bill/debt workflows)
- [ ] Interest rate and payment schedules
- [ ] Debt payoff projections
- [ ] Minimum payment tracking

### Priority 5: Reporting & Analytics

#### Reports

- [x] Income vs. expense monthly summary (dashboard)
- [ ] Category breakdown report
- [x] Account balance over time
- [x] Budget performance summary (basic)
- [ ] Cash flow analysis
- [ ] Custom date range selection (report UI)

#### Net Worth Tracking

- [x] Historical net worth queries (API)
- [ ] Historical net worth chart (UI)
- [ ] Asset vs. liability breakdown
- [ ] Net worth milestones

#### Data Visualization

- [x] Interactive balance chart (dashboard)
- [ ] Drill-down capabilities
- [ ] Export charts as images

### Priority 6: Multi-Currency & Exchange

#### Currency Management

- [x] Manual currency management (create/list)
- [ ] Currency exchange rate tracking
- [ ] Automatic exchange rate fetching (API integration)
- [ ] Transfers between different currencies with conversion
- [ ] Native currency reporting

### Priority 7: Data Management

#### Import

- [ ] CSV import with field mapping
- [ ] Bank statement import (OFX, QIF formats)
- [ ] Duplicate detection on import
- [ ] Import history and undo

#### Export

- [ ] Export transactions to CSV
- [ ] Export full data backup
- [ ] Scheduled automatic backups

### Priority 8: Security & Multi-User

#### Two-Factor Authentication (2FA)

- [ ] TOTP-based 2FA (Google Authenticator, Authy)
- [ ] Backup codes
- [ ] Remember trusted devices

#### Multi-User Support

- [ ] Multiple user accounts
- [ ] Shared accounts/budgets between users
- [ ] User roles and permissions

### Priority 9: Integrations

#### REST API

- [ ] Full API coverage for all features
- [ ] API authentication (tokens)
- [ ] API documentation

#### External Integrations

- [ ] Bank connection (Plaid, Salt Edge, or similar)
- [ ] Webhook support for external automation
- [ ] Calendar integration for bills/recurring transactions

### Priority 10: Quality of Life

#### Search & Filtering

- [ ] Global transaction search
- [ ] Advanced filters (date range, amount range, multiple accounts)
- [ ] Saved filter presets

#### Notifications

- [ ] In-app notifications
- [ ] Email notifications for important events
- [ ] Configurable notification preferences

#### Mobile Experience

- [ ] Responsive mobile-first design improvements
- [x] PWA support for mobile installation
- [ ] Quick-add transaction widget

#### Onboarding

- [ ] First-time user setup wizard
- [ ] Sample data option for exploration
- [ ] Guided tours for features

---

## 🎯 Recommended Next (Near-Term)

1. **Categories CRUD + report foundation**
   - Add dedicated categories (not just free-text fields), then build category breakdown reporting.
2. **Recurring transactions**
   - Biggest user-value jump after current transaction/edit/delete flow.
3. **Budget completion**
   - Add rollover logic and budget period boundary handling.
4. **Historical net worth chart UI**
   - API exists; convert it into a first-class dashboard/report page.
5. **Import/Export baseline**
   - Start with CSV export + CSV import (mapped fields) for practical data portability.

---

## 📝 Notes

- Amounts are stored as integers (cents) to avoid floating-point issues.
- Current architecture follows a simplified layered DDD approach without dependency injection.
- The app uses shadcn-svelte for UI components with Tailwind CSS.
- Data is stored in PostgreSQL via Drizzle ORM.
- Event store remains the source of truth; projections are optimized read models.
