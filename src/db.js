import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('jobs.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    source TEXT, company TEXT, title TEXT, url TEXT, location TEXT,
    score INTEGER, reasons TEXT, red_flags TEXT,
    notified INTEGER DEFAULT 0,
    seen_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

for (const col of ['gaps', 'why']) {
  try { db.exec(`ALTER TABLE jobs ADD COLUMN ${col} TEXT`); } catch { /* колонка вже є */ }
}

const has = db.prepare('SELECT 1 FROM jobs WHERE id = ?');
const insert = db.prepare(`
  INSERT OR IGNORE INTO jobs (id, source, company, title, url, location, score, reasons, red_flags, gaps, why)
  VALUES (@id, @source, @company, @title, @url, @location, @score, @reasons, @red_flags, @gaps, @why)
`);

export const isSeen = (id) => !!has.get(id);
export const saveJob = (job, result) =>
  insert.run({
    id: job.id,
    source: job.source,
    company: job.company ?? '',
    title: job.title,
    url: job.url,
    location: job.location ?? '',
    score: result?.score ?? null,
    reasons: JSON.stringify(result?.reasons ?? []),
    red_flags: JSON.stringify(result?.red_flags ?? []),
    gaps: JSON.stringify(result?.gaps ?? []),
    why: result?.why ?? '',
  });

export const allScored = () =>
  db
    .prepare(
      `SELECT id, title, company, url, location, score, reasons, gaps, why, red_flags, seen_at
       FROM jobs WHERE score IS NOT NULL ORDER BY score DESC, seen_at DESC`
    )
    .all();
