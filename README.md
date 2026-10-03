# EduVoice

Student Feedback and Suggestion System built with Express.js and EJS.

## Project Structure

```text
EduVoice/
├── public/
│   ├── css/
│   ├── images/
│   └── js/
├── database/
│   └── eduvoice.sql
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── tests/
│   ├── utils/
│   ├── views/
│   ├── app.js
│   └── server.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Core folders

- `src/config`: database and environment configuration
- `src/controllers`: request handlers
- `src/middleware`: auth and request validation
- `src/models`: database/entity models
- `src/routes`: API route registration
- `src/scripts`: database setup and admin bootstrap scripts
- `src/services`: business logic and reusable service layer
- `src/utils`: helper functions and small utilities
- `src/views`: EJS templates
- `public`: static frontend assets

## Pages

- `/`: Home page with the EduVoice introduction and getting-started links
- `/about`: Separate About, Features, and How It Works page

## Import the database with XAMPP

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`.
3. Select **Import**, choose `database/eduvoice.sql`, then click **Import**.
   The script creates the `eduvoice` database and its tables, then inserts the
   default feedback categories.
4. Copy `.env.example` to `.env` if you have not created one yet. Set the
   database settings to match your XAMPP MySQL configuration, including
   `DB_NAME=eduvoice`. A typical local XAMPP setup uses `DB_HOST=localhost`,
   `DB_PORT=3306`, `DB_USER=root`, and an empty `DB_PASSWORD`.
5. Run the app with `npm run dev`.

If you choose a different database name in the SQL file, use the same name for
`DB_NAME` in `.env`.

The same SQL file is used by `npm run db:setup`; it creates the configured
`DB_NAME` without maintaining a separate copy of the schema in JavaScript.
The setup also seeds Academic, Campus Environment, Facilities, Other, Student
Services, Teachers/Faculty, and Technology categories using idempotent inserts.
It creates the initial departments (Academic Affairs, Facilities, IT Services,
and Student Services) and safely adds the feature columns to an existing EduVoice
database. Re-run `npm run db:setup` after upgrading to apply the migration.

## Feedback workflow features

- Students can select Low, Normal, High, or Urgent priority (Normal is the
  default). Administrators can update a submission's priority and filter lists
  by priority or department.
- Administrators can assign a submission to a department queue and/or an active
  staff member. They manage staff department membership from the user's details
  page. Staff see directly assigned submissions and unassigned submissions for
  their own department; unassigned submissions without a department are visible
  to staff who have no department.
- Staff and administrators provide resolution notes when moving a submission to
  Resolved. Notes are visible to the submitting student.
- Students may attach up to three PDF, JPEG, PNG, GIF, or WebP files, each up to
  3 MB. File type and signature are validated. Generated storage names are kept
  outside `public/` under `storage/uploads/` by default; set `UPLOAD_DIR` to an
  absolute path to choose another location. The storage directory is ignored by
  Git. Authenticated download routes check the submitter, assignment, department,
  or administrator access before serving files.
- In-app notifications are created for new submissions, assignments, status and
  priority changes, and staff/admin responses. Users can read only their own
  notifications.
- Administrators can review recent workflow and account-management events at
  `/admin/audit-logs`.

## Seed demo users

After configuring `.env` and creating the database, run
`npm run db:seed-demo` to create or reset one account for each role. The command
refuses to run when `NODE_ENV=production`.

| Role | Email |
| --- | --- |
| Student | `student.demo@my.cspc.edu.ph` |
| Staff | `staff.demo@my.cspc.edu.ph` |
| Admin | `admin.demo@my.cspc.edu.ph` |

The default password for all three accounts is `EduVoiceDemo!2026`. Set
`DEMO_USER_PASSWORD` in `.env` before seeding to use a different password.
Running the command again resets these demo accounts to the configured password
and active status. Do not use these accounts or their password in a deployed
environment.

For production, set `SESSION_SECRET` to a private, random value of at least 32
characters. The example placeholder is ignored in development in favor of a
temporary secret and is rejected in production.
