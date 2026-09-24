# crossfitwarrington.com

The CrossFit Warrington website. Owned by CF Warrington Ltd; built and looked after by Trident AI.

- **Words, photos, prices, coaches, FAQs, blog:** edit at crossfitwarrington.com/admin (see `EDITING_GUIDE.md`). They live in `content/`.
- **Layout and design (locked):** `templates/`, `static/site.css`, `static/scrollcraft.*`.
- **Build:** `npm install && npm run build` → `dist/`. Netlify runs this on every change.
  The build refuses to publish if a page contains the retired number 07764 755 993, says "only CrossFit gym" without "official", has an empty required field, a broken internal link, or a missing photo.
- **Old addresses:** `static/_redirects` (blog posts are added automatically from each post's `old_url`).
- **Timetable:** embedded live from WodBoard; nothing to edit here.
