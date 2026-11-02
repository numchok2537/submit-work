# CLAUDE.md

## What this is

A file-submission site for อาจารย์นำโชค พูลเขตนคร's students (แผนกวิชาช่างเทคนิคคอมพิวเตอร์, วิทยาลัยเทคนิคนครสวรรค์). Students enter their name, pick a classroom and subject, and upload a file for a self-titled piece of work. The teacher reviews submissions, filters by class/subject, downloads files, and enters a score + comment per submission. Separate project from `worksheet`, `online-exam`, `plus-minus`, `token-arena` — no shared code.

Plain static site, no build step, no framework. Open via a local static file server (`python3 -m http.server`) since data is loaded via `fetch()`.

## Architecture

- `index.html` / `js/app.js` — student page. Name + classroom persist in `localStorage` across visits. Classroom is a dropdown (`data/classrooms.json`) with a free-text fallback field, to avoid the messy-freeform-classroom-data problem seen in the online-exam project. Subject list comes from `data/subjects.json` (same subject codes as the `worksheet` project, flattened — no term filtering needed here). Shows the student's own submission history (filtered client-side by name match against the full submission list) including any score/comment the teacher has entered.
- `teacher.html` / `js/teacher.js` — passcode-gated (checked server-side via `adminCheckPasscode`, same pattern as the `plus-minus` project). Lists all submissions, filterable by class/subject, with inline score + comment inputs saved per-row via `setScore`.
- `data/subjects.json` — flat list of subject code/name pairs.
- `data/classrooms.json` — the known classroom list; update this file (not code) if a new classroom needs to appear in the dropdown.
- `apps-script/Code.gs` — backend: a bound Google Sheet (`Submissions` tab, self-provisioning headers) for submission metadata/scores, and Google Drive for the actual files (auto-creates a root folder, then subject → classroom subfolders on first submission). `doPost` handles `submit` (uploads a base64-encoded file + appends a Sheet row), `setScore` (passcode-gated), `adminCheckPasscode`. `doGet` returns all submissions as JSON.
- Files are uploaded as base64 over POST (Apps Script Web Apps have no native multipart/binary upload path) — client-side file size capped at `CONFIG.MAX_FILE_MB` (10MB default) in `js/config.js` to keep the base64 payload reasonable.

## Running / testing

```
python3 -m http.server 8811 --directory .
```
then open `http://localhost:8811/index.html` (student) and `/teacher.html` (teacher, passcode-gated). Needs `js/config.js`'s `API_URL` pointed at a deployed Apps Script Web App to actually submit/list anything — see `apps-script/README.md` for one-time setup. Without it, both pages show a "not connected" placeholder instead of erroring.
