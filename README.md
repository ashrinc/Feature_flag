# feature-flag

# Feature Flags Dashboard

Admin dashboard for the Feature Flag service. Admins use it to create flags, set their values per environment (Development, Staging, Production), roll them out to user groups, and manage API keys for apps.

Built with React 18, Vite, React Router, TanStack Query, Axios, React Hook Form, Radix UI and Tailwind CSS.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

### Environment variables

| Variable | What it does |
| --- | --- |
| `VITE_API_URL` | Base path of the backend API. Default `/api/v1`. |
| `VITE_ADMIN_API_URL` | Base path of the admin auth API (login, me, logout). Default `/api/admin`. |
| `API_PROXY_TARGET` | Where the dev server forwards `/api` requests, e.g. `http://localhost:8080`. |
| `VITE_MOCK_API` | `true` runs the dashboard against the built-in sample API (`src/mock.js`). Only works with `npm run dev`; production builds always call the real backend. |

Sample API login: `admin@example.com` / `password`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Features

- **Flags**: create, edit and delete flags of type Boolean, Number, Threshold and Rollout %. Search and filter by type.
- **Per-environment config**: each environment has its own value. Production changes need the flag key typed to confirm.
- **Targeting**: limit a flag to platforms (Web, Android, iOS) and an app version rule such as `>= 2.4.0`.
- **User group rollout**: give a group (e.g. QA Team) its own value for a flag; everyone else gets the default.
- **User groups**: create, rename and delete groups.
- **Audit log**: every config change per environment, with before and after values.
- **Settings**: rename or archive an environment, create and revoke API keys.

## Project structure

```
src/
  main.jsx            App entry, router, layout (sidebar, environment picker), error page
  api.js              Axios client, cookie + CSRF handling, all API calls as React Query hooks
  auth.jsx            Session handling, login page, current environment hook
  ui.jsx              Shared components (buttons, inputs, dialogs, menus, badges)
  mock.js             Sample API used in development when VITE_MOCK_API=true
  pages/
    Flags.jsx         Flags list, configure dialog, group rollout rules
    Groups.jsx        User groups
    Environment.jsx   Audit log and environment settings
```

## How it works

- **Data**: pages never call Axios directly. They use hooks from `api.js`, so caching, refetching and loading states are handled by React Query.
- **Auth**: cookie-based. Login sets `admin_token` and `csrf_token` cookies; the browser sends them on every request (`withCredentials`). Every POST, PUT, PATCH and DELETE also sends the `X-CSRF-Token` header, read from the `csrf_token` cookie. There's no refresh endpoint, so any `401` sends you back to the login page.
- **Saving config**: the table updates immediately and rolls back if the save fails. Each save sends `expected_version`; a `409` means someone else changed it, and the latest value is reloaded.
- **Environment in the URL**: `/env/:id/flags` etc., so links and refreshes keep the same environment.

## Backend API

Matches the Feature Flag Backend API Specification v1.0 under `/api/v1`, with admin auth under `/api/admin`. Points to confirm with the backend team:

1. `platforms` and `app_version` are sent inside `config` when set.
2. Config updates send `expected_version`; the backend returns `409` when it doesn't match.
3. There is no endpoint to list API keys, so Settings only lists keys created from the current browser. A `GET /api-keys?environment_id=` endpoint would remove this limit.
4. Environments have no type field, so Production is detected from the name containing "prod".
5. The `csrf_token` cookie must be readable by JavaScript (not HttpOnly).