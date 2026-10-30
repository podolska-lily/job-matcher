import Parser from 'rss-parser';

const strip = (html = '') =>
  html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
  'accept-language': 'uk-UA,uk;q=0.9,en;q=0.8',
};

async function fetchFeed(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`DOU відповів ${r.status} на ${url}`);
  return new Parser().parseString(await r.text());
}

async function dou(feedUrls) {
  const feeds = [];
  for (const u of feedUrls) feeds.push(await fetchFeed(u)); // по черзі, без навантаження на сайт
  return feeds.flatMap((feed) => feed.items).map((i) => ({
    id: `dou:${i.guid ?? i.link}`,
    source: 'dou',
    company: '',
    title: i.title ?? '',
    url: i.link,
    location: '', // у RSS локація зазвичай всередині назви й опису
    description: strip(i.content ?? i.contentSnippet ?? ''),
  }));
}

export async function collectAll(config) {
  let jobs = [];
  try {
    jobs = await dou(config.dou.feedUrls);
  } catch (e) {
    console.error(`[dou] помилка: ${e.message}`);
  }
  // одна вакансія може бути в кількох стрічках
  return [...new Map(jobs.map((j) => [j.id, j])).values()];
}
