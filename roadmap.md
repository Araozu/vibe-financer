# Vibe Financer — Roadmap

A personal finance app inspired by Firefly III, built with SvelteKit, Drizzle ORM, and a layered DDD-lite architecture.

---

## ✅ What's Done

### Core Infrastructure
- [x] Layered architecture (Domain / Application / Infrastructure / Presentation)
- [x] SQLite database with Drizzle ORM
- [x] Session-based authentication (login, signup, logout)
- [x] Docker deployment support
- [x] Modern UI with shadcn-svelte components
- [x] **Event Sourcing Architecture** — All state changes stored as immutable events

### Event Sourcing (NEW)
- [x] Event store with versioning and optimistic concurrency
- [x] Domain events: AccountCreated, AccountUpdated, AccountDeleted, TransactionCreated, TransferCreated, TransactionDeleted
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
- [x] Account types: Asset, Expense, Revenue, Liability
- [x] Multi-currency support (per-account currency)
- [x] Initial and current balance tracking
- [x] Account listing with detailed view
- [x] Balance history chart (month-to-date)
- [x] **Historical balance queries** — Get balance at any point in time

### Transactions
- [x] Create transactions (expense, income, transfer)
- [x] Transaction name, description, category, and payee
- [x] Transfers between accounts (same currency only)
- [x] Automatic balance updates on transaction creation
- [x] Recent transactions list with pagination
- [x] Transaction filtering by account
- [x] **Balance snapshots** — Track balance before/after each transaction

### Dashboard
- [x] Summary cards (total balance, monthly income, monthly expenses, savings rate)
- [x] Recent transactions table
- [x] Spending overview chart (mock data)
- [x] Quick transaction creation form
- [x] Account creation when none exist

### APIs (Event Sourced)
- [x] `GET /api/accounts/[id]/history` — Account balance history and audit trail
- [x] `GET /api/accounts/net-worth` — Net worth with time-travel and comparisons
- [x] `GET /api/accounts/audit` — Global audit trail for all events

---

## 🚧 Roadmap — Feature Parity with Firefly III

### Priority 1: Core Financial Features

#### Budgets
- [ ] Create and manage budgets
- [ ] Budget periods (monthly, weekly, yearly, custom)
- [ ] Budget limit tracking with progress indicators
- [ ] Budget vs. actual spending reports
- [ ] Rollover unused budget to next period

#### Categories
- [ ] Category management (CRUD)
- [ ] Category groups/hierarchy
- [ ] Default categories for quick setup
- [ ] Category icons and colors
- [ ] Spending by category reports

#### Piggy Banks / Savings Goals
- [ ] Create savings goals with target amounts
- [ ] Link savings goals to accounts
- [ ] Track progress toward goals
- [ ] Add/remove money from piggy banks
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
- [ ] Edit existing transactions
- [ ] Delete transactions with balance rollback
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
- [ ] Track loans, credit cards, mortgages
- [ ] Interest rate and payment schedules
- [ ] Debt payoff projections
- [ ] Minimum payment tracking

### Priority 5: Reporting & Analytics

#### Reports
- [ ] Income vs. expense report
- [ ] Category breakdown report
- [ ] Account balance over time
- [ ] Budget performance report
- [ ] Cash flow analysis
- [ ] Custom date range selection

#### Net Worth Tracking
- [ ] Historical net worth chart
- [ ] Asset vs. liability breakdown
- [ ] Net worth milestones

#### Data Visualization
- [ ] Interactive charts and graphs
- [ ] Drill-down capabilities
- [ ] Export charts as images

### Priority 6: Multi-Currency & Exchange

#### Currency Management
- [ ] Currency exchange rate tracking
- [ ] Automatic exchange rate fetching (API integration)
- [ ] Manual exchange rate entry
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
- [ ] PWA support for mobile installation
- [ ] Quick-add transaction widget

#### Onboarding
- [ ] First-time user setup wizard
- [ ] Sample data option for exploration
- [ ] Guided tours for features

---

## 📝 Notes

- Amounts are stored as integers (cents) to avoid floating-point issues
- Current architecture follows a simplified layered DDD approach without dependency injection
- The app uses shadcn-svelte for UI components with Tailwind CSS
- Data is stored in SQLite via Drizzle ORM
