# School Mid-Term Test Recording & Reporting System

A working starter implementation of the system described in the SRS document:
multi-tenant SaaS backend (Node.js/Express/MySQL/Sequelize) + React frontend (Vite),
covering the full flow from Superuser school onboarding through mid-term report
card generation (PDF).

This is a functional, tested foundation — not a finished product. It implements
Phases 1–7 of the SRS's suggested development plan (onboarding, academic setup,
teacher/module assignment, students, marks recording, report calculation, PDF
generation) so a development team can build the rest (dashboards polish, CSV
import, edit-approval workflow, etc.) on solid ground.

## What's already working (tested end-to-end)

- Superuser creates a school → system auto-creates the first Manager account with
  a temporary password → Manager is forced to change it on first login
- Manager creates Academic Years (auto-creates Term 1/2/3), Classes, Modules,
  Teachers, Students
- **Modules** support edit and delete (delete is blocked if marks already exist
  against that module, to protect data), and each module has its own **Max
  Score** (e.g. out of 100, or out of 50) separate from its **Weight** (how much
  it counts toward the overall average) — score entry and validation is capped
  to that module's own max, not a blanket 100
- **Classes** have a single "Manage" modal per class: checkboxes to assign/remove
  modules (removal is blocked if marks already exist for that module+class) and
  a dropdown to assign/unassign the class teacher
- **Assignments** page shows every current teacher→module→class assignment in
  one table, with a Remove button (to reassign: remove the old one, create a
  new one)
- **Teachers** page shows each teacher's assigned modules/classes inline
- Subject teachers log in and see **only** their assigned modules/classes; they
  cannot record marks for anything they're not assigned to (tested — returns 403)
- Bulk marks entry, with score validation against each module's own max score,
  and term-locking (locked terms reject new mark submissions with a 423)
- Automatic calculation of weighted average (scores are normalized to a
  percentage of each module's max score before weighting, so modules marked
  out of different totals combine fairly), pass/fail per module, overall
  result, and class ranking
- Individual and full-class report cards as **redesigned** downloadable PDFs
  (color-coded PASS/FAIL, school branding banner, summary box, class rank) —
  see `backend/src/services/pdfService.js`
- Class teacher remarks on a student's report

## Project Structure

```
backend/     Node.js + Express + Sequelize + MySQL API
frontend/    React (Vite) app — Superuser, Manager, and Teacher screens
```

See `backend/` and `frontend/` for their own code; both map directly to the
structure described in the SRS document.

---

## 1. Prerequisites

- Node.js 18+ and npm
- MySQL 8 (running locally or reachable over the network)

## 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env    # if .env.example isn't present, use the .env already provided as a template
```

Edit `.env` with your database credentials. For local development, using MySQL's
`root` account is perfectly fine — you don't need to create a separate database
user:

```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=school_reporting
DB_USER=root
DB_PASSWORD=your_mysql_root_password
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SUPERUSER_EMAIL=superuser@platform.com
SUPERUSER_PASSWORD=ChangeMe123!
```

Create the database (this is the only SQL you need to run):

```sql
CREATE DATABASE school_reporting;
```

(If you'd rather not use `root` — e.g. for a shared/production server — you can
create a dedicated limited-privilege user instead:
```sql
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'app_password';
GRANT ALL PRIVILEGES ON school_reporting.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```
and set `DB_USER=app_user` / `DB_PASSWORD=app_password` in `.env` instead. This
is optional for local development.)

Seed the platform Superuser (this also creates all tables via `sequelize.sync()`):

```bash
npm run seed
```

This prints the Superuser email/password from your `.env` — log in with these
and change the password if this is anything beyond local development.

Start the API:

```bash
npm run dev     # nodemon, auto-restarts on file changes
# or
npm start       # plain node
```

The API runs on `http://localhost:4000` by default. Health check:
`GET http://localhost:4000/api/health` → `{"status":"ok"}`.

### Notes on the current implementation

- **`sequelize.sync()` is used instead of migrations.** This is fine for
  development but should be replaced with proper Sequelize migrations
  (`sequelize-cli`) before production use, so schema changes are tracked and
  reversible.
- **PDF generation** uses `pdfmake` with pdfkit's built-in standard fonts
  (Helvetica), so there are no external font files to manage. If you want
  custom branded fonts later, swap the font descriptors in
  `src/services/pdfService.js` for `.ttf` file paths.
- **Tenant isolation**: every controller derives `schoolId` from the JWT via
  the `scopeToSchool` middleware — never from client input. Keep this pattern
  when adding new endpoints.
- **RBAC**: `authorize('manager', 'teacher')` middleware on each route defines
  who can call it; assignment checks inside controllers (e.g.
  `assertTeacherIsAssigned`) enforce the finer-grained "only your own
  modules/classes" rules.

## 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` (already provided) pointing at your backend:

```
VITE_API_URL=http://localhost:4000/api
```

Start the dev server:

```bash
npm run dev
```

Visit `http://localhost:5173`. Log in with the Superuser credentials from your
`.env`, create a school, then log in as the Manager it creates to explore the
rest of the flow.

### Frontend structure

```
src/
  api/client.js        Axios instance with auth header + error unwrapping
  context/AuthContext   Login state, persisted in localStorage
  components/
    Layout.jsx          Sidebar nav, color-coded by role (violet=Superuser, navy=Manager, gold=Teacher)
    ProtectedRoute.jsx   Role-based route guard
    ui/                 Reusable Button, Card, Badge, Modal, ConfirmProvider, Table, form fields
  pages/
    Login, ChangePassword, Reports (shared by Manager & Class Teacher)
    superuser/          Create/manage schools
    manager/            Academic years, classes, modules, teachers, students, assignments
    teacher/            Marks entry (subject teacher)
```

Styled with **Tailwind CSS v3** (the classic, widely-supported PostCSS-based
setup — configured via `tailwind.config.js` and `postcss.config.js`). Color
tokens (brand navy, gold accent, per-role colors) are defined once in
`tailwind.config.js` under `theme.extend.colors` — change them there to
re-theme the whole app.

> **Troubleshooting (Windows especially):** if you see an error like
> `Unable to resolve '@import "tailwindcss"'` or Vite trying to open a file
> literally named `tailwindcss`, it means `node_modules` is out of sync with
> `package.json` (often from an interrupted install). Fix: delete
> `node_modules` and `package-lock.json` inside `frontend/`, then run
> `npm install` again from a fresh terminal.

**Confirmation modals**: destructive or hard-to-undo actions (suspending a
school, resetting a manager's password, locking/unlocking a term, saving
marks) go through `useConfirm()` (`src/components/ui/ConfirmProvider.jsx`) —
an imperative `await confirm({ title, message, tone })` that shows a modal and
resolves `true`/`false` based on the user's choice. Use this pattern for any
new destructive action you add, rather than a plain `window.confirm`.

## 4. Suggested Next Steps for the Dev Team

1. Replace `sequelize.sync()` with real migrations before touching production data.
2. Add automated tests (the `backend/e2e_test.py` script in this handoff shows
   the exact flow to convert into a Jest/Supertest suite).
3. Build out the Superuser/Manager/Teacher **dashboards** (counts, pass rates,
   completion status) — the data endpoints already exist; this is mostly frontend work.
4. Add the edit-approval workflow for locked terms (SRS section 5.5) if needed.
5. Wire up real email sending for teacher/manager invite credentials (currently
   returned directly in the API response for the Superuser/Manager to relay manually).
6. Add CSV bulk import for marks and student enrollment.

---

*This implementation follows the SRS document previously prepared
(`SRS_School_MidTerm_Reporting_System.docx`) — refer back to it for the full
business rules, data model rationale, and role permission matrix.*
