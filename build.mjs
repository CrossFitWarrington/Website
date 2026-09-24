// content/ + templates/ + static/ -> dist/ (the site Netlify publishes).
// The layout lives in templates/ and site.css and is locked; everything Sian edits is in content/.
// The build FAILS (and the site stays as it was) if a rule below is broken.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import Mustache from 'mustache';

const SITE = 'https://crossfitwarrington.com';
Mustache.escape = s => String(s).replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const OUT = 'dist';
const problems = [];
const read = f => fs.readFileSync(f, 'utf8');
const json = f => JSON.parse(read(f));
const mdFiles = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];

// A link on its own line is the blue button.
marked.use({ renderer: {
  paragraph({ tokens }) {
    const t = tokens.filter(x => !(x.type === 'text' && !x.raw.trim()));
    if (t.length === 1 && t[0].type === 'link') return `<p><a class="cta" href="${t[0].href}">${this.parser.parseInline(t[0].tokens)}</a></p>\n`;
    return false;
  },
} });
const md = s => marked.parse(s || '');
const spans = s => (s || '').split(/\n\s*\n/).filter(x => x.trim()).map(p => `<span>${marked.parseInline(p.trim())}</span>`).join('');
const first = list => (list || []).map((x, i) => (typeof x === 'object' ? { ...x, first: i === 0 } : x));
const need = (obj, keys, where) => keys.forEach(k => { const v = k.split('.').reduce((o, p) => o?.[p], obj); if (v === undefined || v === null || String(v).trim() === '') problems.push(`${where}: "${k}" is empty`); });
const dateLabel = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
const iso = d => new Date(d).toISOString().slice(0, 10);
const text = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---- content ---------------------------------------------------------------
const site = json('content/settings.json');
const nav = json('content/nav.json');
const home = json('content/home.json');
const { coaches: coachList } = json('content/coaches.json');
const faqs = json('content/faqs.json');
need(site, ['free_class_url', 'dropin_url', 'timetable_embed', 'phone', 'whatsapp', 'email', 'address', 'hours', 'claim'], 'Site settings');

faqs.intro_html = md(faqs.intro);
faqs.ask_html = marked.parseInline(faqs.ask.replace(site.email, `[${site.email}](mailto:${site.email})`));
faqs.questions.forEach((q, i) => { need(q, ['question', 'answer'], `FAQ ${i + 1}`); q.answer_html = md(q.answer); });
const coaches = coachList.map((c, i) => { need(c, ['name', 'role', 'photo'], `Coach ${i + 1}`); return { ...c, homepage_html: spans(c.homepage_text) }; });

const shared = {
  site, nav, faqs, coaches,
  phone_tel: site.phone.replace(/\s/g, ''),
  whatsapp_url: 'https://wa.me/44' + site.whatsapp.replace(/\s/g, '').replace(/^0/, ''),
  umami_id: site.umami_id || '',
};
const partials = Object.fromEntries(fs.readdirSync('templates/partials').map(f => [path.basename(f, '.html'), read(`templates/partials/${f}`)]));
const tpl = name => read(`templates/${name}.html`);
const gym = {
  '@context': 'https://schema.org', '@type': 'ExerciseGym', name: 'CrossFit Warrington', legalName: 'CF Warrington Ltd',
  description: "Warrington's only official CrossFit affiliate, based in Woolston. Coached classes for every age and ability, plus Couch to CrossFit, Kids, Adaptive, personal training, nutrition and online coaching.",
  url: SITE + '/', image: SITE + '/assets/r6-03.jpg', logo: SITE + '/assets/cfw_lockup_horizontal_reversed.svg',
  telephone: '+44 ' + shared.phone_tel.slice(1), email: site.email,
  address: { '@type': 'PostalAddress', streetAddress: '14 Greys Court, Kingsland Grange, Woolston', addressLocality: 'Warrington', postalCode: 'WA1 4SH', addressCountry: 'GB' },
  geo: { '@type': 'GeoCoordinates', latitude: 53.406728, longitude: -2.53812 }, areaServed: 'Warrington',
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '05:30', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday'], opens: '08:00', closes: '10:00' },
  ],
  sameAs: [site.instagram, site.facebook, site.youtube].filter(Boolean),
};
const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.questions.map(q => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: text(q.answer_html) } })) };
const ld = o => JSON.stringify(o).replace(/</g, '\\u003c');

const pages = [];   // [url path, html]
const render = (name, view, urlPath, head) => {
  const html = Mustache.render(tpl(name), {
    ...shared, ...view,
    title: head.title, description: head.description, og_type: head.og_type || 'website',
    canonical: SITE + urlPath, noindex: head.noindex, og_image: SITE + (head.image || '/assets/r6-03.jpg'), jsonld: head.jsonld || [],
  }, partials);
  pages.push([urlPath, html]);
};

// ---- homepage --------------------------------------------------------------
need(home, ['seo_title', 'seo_description', 'hero.heading', 'turn.heading', 'join.heading', 'close.heading'], 'Homepage');
home.join.tiles.forEach((t, i) => need(t, ['title', 'photo', 'text'], `Homepage "Join us" tile ${i + 1}`));
const slot = s => ({ ...s, href: s.link || site.free_class_url });
render('home', {
  ...home,
  hero: { ...home.hero },
  turn: { ...home.turn, body_html: md(home.turn.body), middle_html: md(home.turn.middle) },
  join: { ...home.join, tiles: home.join.tiles.map(t => ({ ...t, text_html: spans(t.text), links: first(t.links) })) },
  reviews: { ...home.reviews, featured: first(home.reviews.featured) },
  day: { ...home.day, classes: home.day.classes.map(slot), weekend_classes: home.day.weekend_classes.map(slot), photos: first(home.day.photos) },
}, '/', { title: home.seo_title, description: home.seo_description, jsonld: [ld(gym), ld(faqLd)] });

// ---- blog ------------------------------------------------------------------
const posts = mdFiles('content/blog').map(f => {
  const { data, content } = matter(read(`content/blog/${f}`));
  const slug = path.basename(f, '.md');
  need(data, ['title', 'date'], `Blog post ${f}`);
  const categories = data.categories || [];
  return { ...data, slug, body: content, categories, categories_label: categories.join(', '), date_label: dateLabel(data.date), date_iso: iso(data.date) };
}).sort((a, b) => (a.date_iso < b.date_iso ? 1 : -1));
for (const p of posts) {
  render('post', { post: p, date_label: p.date_label, categories: p.categories, categories_label: p.categories_label, body_html: md(p.body) },
    `/blog/${p.slug}`, { title: `${p.title} | CrossFit Warrington`, description: p.summary || text(md(p.body)).slice(0, 155), image: p.photo, og_type: 'article' });
}

// ---- pages -----------------------------------------------------------------
for (const f of mdFiles('content/pages')) {
  const { data, content } = matter(read(`content/pages/${f}`));
  const slug = path.basename(f, '.md');
  need(data, ['title', 'description', 'heading'], `Page ${f}`);
  const layout = data.layout || 'page';
  render('page', {
    page: data, slug, body_html: md(content),
    [`is_${layout}`]: true, posts: layout === 'blog' ? posts : [],
  }, `/${slug}`, { title: data.title, description: data.description, image: data.photo, noindex: data.noindex, jsonld: layout === 'faqs' ? [ld(faqLd)] : [] });
}

// ---- write + check ---------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync('static', OUT, { recursive: true });
const urls = new Set(pages.map(([u]) => u));
const redirects = fs.existsSync('static/_redirects') ? read('static/_redirects').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.split(/\s+/)[0]) : [];
for (const [u, html] of pages) {
  const where = u === '/' ? 'Homepage' : u;
  if (/0?7764\s?755\s?993|7764755993/.test(html)) problems.push(`${where}: contains the retired number 07764 755 993`);
  if (/only\s+(?!official\b)CrossFit\s+gym/i.test(text(html))) problems.push(`${where}: says "only CrossFit gym" without "official"`);
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const clean = href.replace(/\/$/, '') || '/';
    if (!urls.has(clean) && !fs.existsSync(path.join(OUT, clean)) && !redirects.includes(clean)) problems.push(`${where}: link to ${href} goes nowhere`);
  }
  for (const [, src] of html.matchAll(/src="(\/assets\/[^"]+)"/g)) if (!fs.existsSync(path.join(OUT, decodeURI(src)))) problems.push(`${where}: photo ${src} is missing`);
  const file = u === '/' ? 'index.html' : `${u.slice(1)}.html`;
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), html);
}
const unique = [...new Set(problems)];
if (unique.length) {
  console.error(`\nBUILD STOPPED: ${unique.length} problem(s). Nothing was published.\n` + unique.map(p => ' - ' + p).join('\n') + '\n');
  process.exit(1);
}
// each post's old GoDaddy address -> its new one (both the encoded and plain spelling), ahead of the /blog/f/* catch-all
const postRules = posts.filter(p => p.old_url).flatMap(p => [...new Set([p.old_url, decodeURI(p.old_url)])].map(u => `${u.replace(/ /g, '%20')}  /blog/${p.slug}  301`));
const base = read('static/_redirects').split('\n');
const at = base.findIndex(l => l.startsWith('/blog/f/*'));
fs.writeFileSync(`${OUT}/_redirects`, [...base.slice(0, at), ...postRules, ...base.slice(at)].join('\n'));
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].filter(u => u !== '/404' && u !== '/thank-you').map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages (${posts.length} blog posts) into ${OUT}/`);
