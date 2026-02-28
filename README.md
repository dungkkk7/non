Simple Blog (2 Sections)
========================

Static personal blog focused on exactly two content groups:
- Draft Papers (PDF)
- Blog Posts (Markdown)

Project structure
- `index.html` - Main UI (home list + detail view)
- `script.js` - Data loading, rendering, and route handling (`?post=id`)
- `styles.css` - Theme and responsive layout
- `data/posts.json` - Content metadata
- `posts/` - Markdown files and PDF files

Run locally
```bash
python -m http.server 8000
```
Open `http://localhost:8000`

Data format (`data/posts.json`)
Each item must use `type` as either `paper` or `blog`:

```json
{
  "id": "my-draft-paper",
  "type": "paper",
  "title": "Draft: Loader Behavior Study",
  "excerpt": "Working draft for discussion.",
  "file": "posts/loader-draft.pdf",
  "date": "2026-02-28",
  "tags": ["research", "loader"]
}
```

```json
{
  "id": "my-blog-post",
  "type": "blog",
  "title": "Notes about PE Parsing",
  "excerpt": "Short notes and examples.",
  "file": "posts/pe-parsing.md",
  "date": "2026-02-28",
  "tags": ["reverse", "windows"],
  "mins": 6
}
```

Notes
- `paper` posts render an embedded PDF viewer in the detail page.
- `blog` posts render Markdown via `marked` + syntax highlight via `highlight.js`.
