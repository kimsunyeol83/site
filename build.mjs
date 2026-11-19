// content/ 의 내용으로 HTML 페이지를 만든다. 의존 패키지 없음.
// 사용: node build.mjs
// 만들어지는 HTML(index.html, 각 폴더의 index.html)은 직접 고치지 않는다. content/ 를 고치고 다시 실행한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, 'content', p), 'utf8'));
const site = read('site.json');
const works = read('works.json');
const dims = read('images.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (h) => h.replace(/<[^>]+>/g, '').trim();

function page({ title, description, pathName, body, bodyClass = '' }) {
  const full = title ? `${title} — ${site.title}` : site.title;
  const nav = site.nav
    .map((n) => {
      const on = n.match.some((m) => (m === '/' ? pathName === '/' : pathName.startsWith(m)));
      return `<a href="${n.href}"${on ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
    })
    .join('\n        ');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(full)}</title>
  <meta name="description" content="${esc(description || site.description)}">
  <meta property="og:title" content="${esc(full)}">
  <meta property="og:description" content="${esc(description || site.description)}">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <header class="site-header">
    <a class="site-name" href="/">${esc(site.nameKo)} <span>${esc(site.nameEn)}</span></a>
    <nav class="site-nav" aria-label="메뉴">
        ${nav}
    </nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <a href="${esc(site.instagram.href)}" target="_blank" rel="noopener">${esc(site.instagram.label)}</a>
  </footer>
  <script src="/js/site.js" defer></script>
</body>
</html>
`;
}

function write(pathName, html) {
  const file = path.join(root, pathName.replace(/^\//, ''), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// ---------- 이미지 ----------
function img(id, { sizes, alt = '', eager = false }) {
  const d = dims[id];
  if (!d) throw new Error(`images.json 에 ${id} 가 없습니다. node tools/images.mjs 를 먼저 실행하세요.`);
  const big = `/img/work/${id}-1600.webp`;
  const small = `/img/work/${id}-800.webp`;
  const srcset = d.w > 800 ? ` srcset="${small} 800w, ${big} ${d.w}w" sizes="${sizes}"` : '';
  return `<img src="${big}"${srcset} width="${d.w}" height="${d.h}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} decoding="async" data-full="${big}">`;
}
const figure = (m, sizes, extra = '') => {
  const d = dims[m.img];
  const alt = m.caption ? strip(m.caption.replace(/<br>/g, ' ')) : '';
  let inner = img(m.img, { sizes, alt });
  if (m.link) inner = `<a href="${esc(m.link)}" target="_blank" rel="noopener">${inner}</a>`;
  const style = extra === 'row' && d ? ` style="flex:${(d.w / d.h).toFixed(4)}"` : '';
  return `<figure class="fig${m.link ? ' fig--link' : ''}"${style}>${inner}${m.caption ? `<figcaption>${m.caption}</figcaption>` : ''}</figure>`;
};

function modules(mods) {
  return mods
    .map((m) => {
      if (m.type === 'image') return figure(m, '(min-width: 1180px) 1100px, 94vw');
      if (m.type === 'row')
        return `<div class="row">${m.items
          .map((it) => (it.type === 'image' ? figure(it, '(min-width: 1180px) 550px, (min-width: 640px) 47vw, 94vw', 'row') : modules([it])))
          .join('')}</div>`;
      if (m.type === 'grid')
        return `<figure class="fig"><div class="grid">${m.imgs.map((id) => img(id, { sizes: '(min-width: 1180px) 360px, (min-width: 640px) 31vw, 47vw' })).join('')}</div>${
          m.caption ? `<figcaption>${m.caption}</figcaption>` : ''
        }</figure>`;
      if (m.type === 'video')
        return `<figure class="fig fig--video"><div class="video" style="aspect-ratio:100/${m.ratio}"><iframe src="${esc(m.src)}" title="${esc(
          m.caption ? strip(m.caption) : '영상'
        )}" loading="lazy" allowfullscreen></iframe></div>${m.caption ? `<figcaption>${m.caption}</figcaption>` : ''}</figure>`;
      if (m.type === 'text') return `<div class="prose">\n${m.html}\n</div>`;
      return '';
    })
    .join('\n');
}

// ---------- Work 목록 ----------
// 연도는 전시 제목 옆 괄호 안에 붙인다. 제목 끝 괄호 안에 이미 그 연도가 있으면(예: "(Since 2014)") 덧붙이지 않는다.
function titleWithYear(w) {
  const t = esc(w.title);
  if (!w.year) return t;
  const y = String(w.year).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('\\([^)]*' + y + '[^)]*\\)\\s*$').test(w.title)) return t;
  return `${t} <span class="yr">(${esc(w.year)})</span>`;
}

function worksPage(pathName) {
  // 최근 연도가 먼저. 같은 연도 안에서는 works.json 에 적힌 순서대로.
  const list = works
    .map((w, i) => ({ w, i }))
    .sort((a, b) => parseInt(b.w.year) - parseInt(a.w.year) || a.i - b.i)
    .map((x) => x.w);
  const body = `    <div class="works">
${list
  .map((w, i) => {
    const d = dims[`cover/${w.slug}`];
    const cover = d
      ? `<img src="/img/cover/${w.slug}.webp" width="${d.w}" height="${d.h}" alt=""${i < 3 ? '' : ' loading="lazy"'} decoding="async">`
      : '<span class="card__empty"></span>';
    return `      <a class="card" href="/${w.slug}/">
        <span class="card__img">${cover}</span>
        <span class="card__title">${titleWithYear(w)}</span>
      </a>`;
  })
  .join('\n')}
    </div>`;
  write(pathName, page({ title: pathName === '/' ? '' : 'Work', pathName, body }));
}
worksPage('/');
worksPage('/work/');

// ---------- 작업 페이지 ----------
for (const w of works) {
  const data = read(`work/${w.slug}.json`);
  const body = `    <article class="work">
      <header class="work__head">
        <h1>${titleWithYear(w)}</h1>
      </header>
${modules(data.modules)}
    </article>`;
  write(`/${w.slug}/`, page({ title: w.title, pathName: `/${w.slug}/`, body }));
}

// ---------- TEXT ----------
{
  const { essays } = read('text.json');
  const meta = essays.map((e, i) => {
    const titles = [];
    let author = '';
    for (const l of e.html.split('\n')) {
      const c = l.match(/^<p class="(?:gap )?c">([\s\S]*)<\/p>$/);
      const r = l.match(/^<p class="(?:gap )?r">([\s\S]*)<\/p>$/);
      if (c) titles.push(strip(c[1]));
      else if (r) {
        author = strip(r[1]);
        break;
      } else break;
    }
    return { id: `text-${i + 1}`, titles, author };
  });
  const body = `    <div class="texts">
      <ol class="texts__index">
${meta.map((m) => `        <li><a href="#${m.id}"><span>${m.titles.join(' — ')}</span><span class="texts__author">${m.author}</span></a></li>`).join('\n')}
      </ol>
${essays.map((e, i) => `      <article class="prose essay" id="${meta[i].id}">\n${e.html}\n      </article>`).join('\n')}
    </div>`;
  write('/text/', page({ title: 'Text', pathName: '/text/', body }));
}

// ---------- INFO (CV) ----------
{
  const { blocks } = read('cv.json');
  const body = `    <div class="cv">
${blocks.map((b, i) => `      <section class="prose cv__col"${i === 1 ? ' lang="en"' : ''}>\n${b.html}\n      </section>`).join('\n')}
    </div>`;
  write('/cv/', page({ title: 'Info', pathName: '/cv/', body }));
}

// ---------- Contact ----------
{
  const { blocks } = read('contact.json');
  const body = `    <div class="contact prose">
${blocks.map((b) => b.html).join('\n')}
    </div>`;
  write('/contact/', page({ title: 'Contact', pathName: '/contact/', body }));
}

console.log(`만들었습니다: 홈, work, 작업 ${works.length}개, text, cv, contact`);
