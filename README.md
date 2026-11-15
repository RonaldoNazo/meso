# Meso — practice question dumps

A static study app. Browse a public library of question dumps, import your own CSV or
Excel file, and practise with progress that lives only in your browser. No accounts, no
server, no tracking.

Built with React 19, Vite and Meta's [Astryx](https://astryx.atmeta.com) design system.
The production site is plain files — it can live on GitHub Pages, any static host, or a
USB stick.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm run preview  # serve dist/
npm run index    # rebuild public/library/index.json from library/
```

`npm run dev` and `npm run build` run the library indexer first, so new dumps show up
automatically.

## What it does

- **Public library** — search and filter dumps by university, course, year and tags.
  Every visitor reads them from the same static files.
- **Your own files** — CSV, TSV, XLSX or XLS, parsed in the browser. Nothing is uploaded.
- **Four question types** — single choice, multiple choice, true/false and short answer
  (reveal the model answer, then grade yourself).
- **Progress that follows the question** — answers are keyed by a hash of the question
  text and options, not by row number. Re-import a corrected file, or update a dump,
  and your history stays attached to the questions that did not change.
- **Unseen first** — a 30-question session serves untouched questions first, then ones
  you got wrong, then ones you already know. You do not cycle the same five questions.
- **Resume** — close the tab mid-session and pick it up where you left off.
- **Keyboard** — `1`–`8` answer, `Enter` next, `F` flag, `Esc` leaves the session.
- **Backup** — export progress as JSON and restore it on another device.
- **Dark mode** and a mobile layout straight from the Astryx theme.

Clearing site data clears progress. That is the whole trade-off of having no backend;
use **Progress → Export backup** if it matters.

## Deploy on GitHub Pages

1. Push this repository to GitHub.
2. Settings → Pages → Build and deployment → **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` builds and publishes `dist/`.

`vite.config.ts` uses `base: './'` and the app uses hash routing (`#/dump/...`), so it works
from `https://<user>.github.io/<repo>/` without any extra configuration or a 404 page.
For a custom domain, nothing changes.

## Add dumps to the public library

```text
library/
  unilag/
    _meta.json
    medicine-anatomy-200l.csv
  uniben/
    _meta.json
    law-nigerian-legal-system-100l.csv
```

Each `.csv`/`.tsv` uses the format in [docs/FORMAT.md](docs/FORMAT.md). Each university
folder has a `_meta.json`:

```json
{
  "university": "University of Lagos",
  "course": "Medicine & Surgery",
  "year": "200L",
  "license": "CC BY 4.0"
}
```

The file name becomes the title (`medicine-anatomy-200l` → “Medicine Anatomy 200L”).
Override it per file with `medicine-anatomy-200l.meta.json`:

```json
{"title": "Anatomy — 200L", "year": "200L", "tags": ["upper limb", "head & neck"]}
```

`npm run build` regenerates `public/library/index.json` and copies the dumps into the
site. Then commit and push. See [docs/LIBRARY.md](docs/LIBRARY.md) for details and for
moving the library to S3/CDN later.

## Format

The canonical header, all four question types, validation rules and the quoting trap are
documented in [docs/FORMAT.md](docs/FORMAT.md). The Import screen also has
“Download CSV template” and “Download Excel template” buttons.

## Project layout

```text
src/
  lib/        parsing, hashing, storage (IndexedDB), session picking, backup, router
  screens/    browse, dump, practice, results, import, progress
  components/ shared page pieces
library/      source dumps (input to the build)
tools/        build-index.ts — library/ → public/library/
public/       generated library, templates, icons
docs/         FORMAT.md, LIBRARY.md
```

Progress uses IndexedDB through `idb`; the theme and session size live in
`localStorage`. No data leaves the device.
