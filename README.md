# Roomwise Dynamic

Roomwise is a full-stack classroom availability finder built from the supplied SRM SEEE timetable PDFs. This version is converted from the original static site into a dynamic Node.js application that runs cleanly from VS Code.

## What changed from the static version

- Added a Node.js backend server.
- Added REST API endpoints for timetable data, health checks, room metadata, and classroom search.
- Room floor, AC, and capacity details are now persisted on the server in `server-data/room-details.json` instead of browser `localStorage`.
- The frontend loads its timetable and room metadata from `/api/data`.
- The existing timetable engine and natural-language parsing logic are retained.
- No external database or API key is required.
- No npm dependencies are required; the backend uses Node's built-in HTTP and file-system modules.

## Run in VS Code

1. Install Node.js 18 or newer.
2. Extract this project and open the `roomwise-dynamic` folder in VS Code.
3. Open **Terminal > New Terminal**.
4. Run:

   ```bash
   npm run dev
   ```

5. Open `http://127.0.0.1:3000` in your browser.

For a normal non-watch run, use:

```bash
npm start
```

You do not need to run `npm install` because the project has no third-party packages.

## Tests

Run:

```bash
npm test
```

This runs the original timetable-engine tests plus API tests for the dynamic backend.

## Dynamic API

- `GET /api/health` — server status.
- `GET /api/data` — timetable, source list, events, and server-persisted room metadata.
- `GET /api/metadata` — saved floor, AC, and capacity overrides.
- `PUT /api/metadata` — save confirmed room metadata.
- `POST /api/search` — run either structured filter search or natural-language search on the server.

Example structured request body:

```json
{
  "filters": {
    "date": "2026-09-28",
    "time": "11:00",
    "duration": 60,
    "floor": "all",
    "ac": "any",
    "people": ""
  }
}
```

Example natural-language request body:

```json
{
  "text": "Ground floor with AC for 6 people for 90 minutes",
  "base": {
    "date": "2026-09-28",
    "time": "11:00",
    "duration": 60,
    "floor": "all",
    "ac": "any",
    "people": ""
  }
}
```

## Project structure

```text
roomwise-dynamic/
├─ server.mjs                  Dynamic Node server and REST API
├─ package.json                VS Code/npm scripts
├─ server-data/
│  └─ room-details.json        Persisted room metadata
├─ dist/
│  ├─ index.html               Frontend
│  ├─ style.css                Styling
│  ├─ app.js                   Browser interaction code
│  ├─ engine.mjs               Availability and text-search engine
│  ├─ data.json                Normalized timetable dataset
│  └─ sources/                 Original timetable PDFs
├─ build_data.py               Reproducible timetable data builder
├─ test-engine.mjs             Timetable engine tests
└─ test-server.mjs             Dynamic API tests
```

## Data boundaries

The supplied archive contains ten PDFs but thirteen timetable pages. Nine PDFs describe the current odd semester 2026–27. The four-page first-year PDF contains older 2024–25 odd/even schedules and remains an archived source rather than being merged into current occupancy.

The timetable source does not supply floor, AC, seat count, semester start/end dates, holidays, weekend schedules, building opening hours, access permissions, or real-time occupancy. Confirmed floor/AC/capacity values can now be entered in **Room details** and are shared through the running Roomwise server.

A room match means no overlapping class is present in the supplied timetable records. It is not a room booking or a guarantee that the room is physically open. Labs are not recommended as open study rooms. The covered timetable window remains 09:00–16:50 on weekdays.

## NETHER Round 2 Phase 1 — Live Map + Call the Squad

The frontend now also includes:

- A schematic interactive building map grouped by the room metadata floors. It is explicitly labelled not to scale.
- Room colors driven by the same verified timetable availability engine used by the search results.
- Clickable map rooms that open a live room detail panel.
- A live seconds-level countdown to the next listed class when the selected date is today and the next class can be determined.
- A **Call the Squad on WhatsApp** action for free classroom results. It opens WhatsApp with a pre-filled message such as: `📍 Heading to IST 509. It's free until 2:30 PM. Come fast!`
- The map and the original natural-language search/results are part of the same application and deployment.

The map is a visual/schematic building representation, not a claim about the college's exact architectural floor plan. Timetable availability remains a timetable-derived signal, not a booking or guarantee of physical access.
# free-classroom-finder
