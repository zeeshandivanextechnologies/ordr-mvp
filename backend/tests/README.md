# Backend tests

API tests for the QA scenarios in the Phase 1 spec (Module 37), using Node's built-in test runner.

## Run

```bash
npm run test:db   # once: creates the local test database (<DB_NAME>_test) and applies all migrations
npm test          # runs every tests/*.test.js file
```

After adding a new migration, run `npm run test:db` again (only new migrations are applied).
`npm run test:db -- --reset` drops and rebuilds the test database.

## Safety

`tests/setup.js` runs before every test file:

- The app uses the **test database**: `<DB_NAME>_test` from `.env`, or `TEST_DATABASE_URL` / `TEST_DB_NAME` if set.
  Tests refuse to start when the database name does not contain "test" or the host is a hosted
  production database (Neon, Render, AWS).
- **No email is sent** (`EMAIL_DISABLED=true`: messages are built but not delivered).
- **No real AI call** is made: tests give fake Gemini answers (`mockAi` in `helpers.js`).
- **No Razorpay call** is made (keys are cleared, payments count as "not configured").

Each file creates its own companies and removes them at the end.

## What is covered

| File | Spec scenarios |
|---|---|
| `auth.test.js` | Signup, login, logout, password reset (OTP), onboarding state |
| `orders.test.js` | Manual sales and purchase orders, multiple line items, edit order, search |
| `shipments.test.js` | 10 MT order, 6 MT shipment, 4 MT balance, second shipment, full delivery, over-allocation, shipment edit |
| `alerts.test.js` | Overdue, due soon, stale, missing LR, partial fulfilment, no duplicate alerts |
| `gmail-ai.test.js` | Valid PO email, marketing email, duplicate email, missing quantity, confidence, review, confirm, ignore, update email matching |
| `security.test.js` | Company A cannot see company B (every module), member vs admin, no-login access, removed users |
| `api.test.js` | Original tests: auth tokens, orders, plan expiry, billing, proration, invoices |

Not automated: Google sign-in and real Gmail / Razorpay (need live accounts), and responsive
desktop / tablet / mobile checks (need a browser).
