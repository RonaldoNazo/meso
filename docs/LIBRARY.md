# The public library

The library is a folder of files, indexed at build time and served as static assets. No
database, no API, no admin panel. Adding a dump is a commit.

## Layout

```text
library/
  universiteti-mjekesor-i-tiranes/
    _meta.json
    farmakologji/
      _meta.json
      questions.csv
    kardiologji/
      _meta.json
      questions.csv
```

`npm run build` produces:

```text
public/library/
  index.json
  dumps/universiteti-mjekesor-i-tiranes-farmakologji.csv?v=ab12cd
  dumps/universiteti-mjekesor-i-tiranes-kardiologji.csv?v=98fe21
```

A folder can hold one dump named `questions.csv`, or several files named after the topic.
`_meta.json` is merged from the library root down, so the university lives once at the top
and each category folder only adds its title.

`public/library/` is generated and git-ignored. The `?v=` hash changes whenever the file
content changes, so a browser or CDN cache cannot serve a stale dump.

## `_meta.json`

Root of a university:

```json
{
  "university": "Universiteti Mjekësor i Tiranës",
  "course": "Licensa",
  "license": "Study use",
  "tags": ["medicine", "licensing exam", "Albania"]
}
```

Category folder:

```json
{
  "title": "Farmakologji",
  "tags": ["Farmakologji"]
}
```

| Field | Default |
|---|---|
| `university` | the first folder name, title-cased |
| `title` | the file name, or the folder's `title` when the file is `questions.csv` |
| `course`, `year`, `license` | none |
| `tags` | collected from the questions' own tags, capped at 12 |

The file name becomes the title: `medicine-anatomy-200l` → “Medicine Anatomy 200L”.
Per-file overrides live next to the file, named `<file>.meta.json`:

```json
{
  "title": "Anatomy — 200L (2024 past questions)",
  "year": "200L",
  "tags": ["upper limb"]
}
```

Folders may nest; the id becomes the slug of the whole path plus the file name, so
`library/unilag/medicine/anatomy.csv` → `unilag-medicine-anatomy`.

## Publishing

```bash
npm run index      # optional: rebuild the catalogue locally
npm run build      # does it too
git add library/ && git commit -m "add UNILAG anatomy dump" && git push
```

GitHub Pages redeploys in about a minute. The site picks up the new dump and its search
entry together; there is no second place to update.

If a dump has rows with errors, the build reports how many were skipped and still
publishes the valid questions. It refuses only files with zero readable questions.

## Moving the library to S3 or a CDN

The app already reads from a base URL: set `VITE_LIBRARY_URL` at build time and it
fetches `<base>/index.json` and `<base>/<dump url>` instead of the bundled copy.

```bash
VITE_LIBRARY_URL=https://dumps.example.com npm run build
```

Upload the same shape:

```text
s3://<bucket>/index.json                       Cache-Control: max-age=60
s3://<bucket>/dumps/<id>.csv?v=…               Cache-Control: max-age=31536000, immutable
```

Bucket policy and CORS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::<bucket>/*"
    }
  ]
}
```

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Only you can write to the bucket; the app only reads. Keep the site's GitHub Pages
deployment as is — the library simply moves.

The library is public either way. There is no “unlisted” mode: a URL that works in the
browser can be requested by anyone. Keep private material out of both the repository and
the bucket.
