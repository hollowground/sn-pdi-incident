# Incident Workflow App

A ServiceNow UI Page application for managing assigned incidents with a mobile-first experience.

## Overview

This app is designed for frontline incident handling:

- View incidents assigned to the current user
- Search, filter, and prioritize incident work
- Transition incident states (`Start`, `Pause`, `Resume`, `Complete`, `Incomplete`)
- Add work-note comments
- Report new incidents directly from the app
- Use the app on mobile without needing a separate mobile URL
- Continue working offline and sync changes when back online

## Key Features

- **Assigned queue view** with expandable incident cards
- **Completion workflow** with resolution code + close notes
- **Sorting and filtering**
  - Directly reported incidents pinned to top
  - Remaining incidents sorted by due date (oldest first)
  - Open/completed filter options
- **Auto refresh** with online polling and focus refresh
- **Offline mode**
  - Caches incident list after first successful online load
  - Queues offline updates (state changes, comments, new incident reports)
  - Auto-syncs queued changes when connectivity returns
- **Toast notifications** for newly assigned incidents
- **Mobile-first UI**
  - Responsive layout
  - Bottom navigation with icons
  - Safe-area support for modern mobile devices

## Tech Stack

- React + TypeScript
- ServiceNow Fluent SDK (`@servicenow/sdk`)
- ServiceNow Table API (`/api/now/table/...`)

## Project Structure

- `src/client/` — React app UI and service layer
- `src/fluent/ui-pages/` — UI Page registration
- `src/fluent/navigation/` — application menu/module wiring
- `src/server/` — server TypeScript placeholder for TS config completeness

## Local Development

Install dependencies:

```bash
npm install
```

Run local dev flow:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Deploy/install to instance:

```bash
npm run deploy
```

## Important ServiceNow Notes

- The app uses `window.g_ck` (`X-UserToken`) for API requests.
- Some fields (like close-code related fields) can be constrained by ACLs/data policies.
- Resolution code values are set to valid incident close-code labels expected by the target instance.
- On mobile, app launch is configured to prefer standalone page behavior to minimize platform shell chrome.

## Offline Behavior

After the first successful online load:

- Incident list is cached locally.
- If offline, user actions are queued locally.
- Queued actions sync in order when online again.
- Sync status is shown in-app.

## Scripts

- `npm run dev` — run development
- `npm run build` — build app artifacts
- `npm run deploy` — install/deploy to instance
- `npm run transform` — transform metadata
- `npm run types` — refresh dependencies/types

## Known Constraints

- Initial authentication and first data load require online connectivity.
- Actual write behavior depends on instance ACLs, data policies, and business rules.

