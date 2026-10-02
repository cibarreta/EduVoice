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
