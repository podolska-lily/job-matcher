import { readFileSync } from 'node:fs';
import { exec } from 'node:child_process';
import { collectAll } from './collectors.js';
import { isSeen, saveJob } from './db.js';
import { prefilter, scoreJob } from './matcher.js';
import { sendTelegram, sendTelegramDocument } from './notify.js';
import { writeReport } from './report.js';

const MAX_MESSAGES = 15; // не засипати чат, якщо одразу багато нових

const config = JSON.parse(readFileSync('config.json', 'utf8'));
const resume = readFileSync('resume.txt', 'utf8');

const all = await collectAll(config);
const fresh = all.filter((j) => !isSeen(j.id));
console.log(`Зібрано: ${all.length}, нових: ${fresh.length}`);

const hits = [];
for (const job of fresh) {
  if (!prefilter(job, config.filters)) {
    saveJob(job, null); // запам'ятати, щоб не перевіряти знову
    continue;
  }
  try {
    const result = await scoreJob(job, resume, config.criteria);
    saveJob(job, result);
    console.log(`\n${result.score}% ${job.title}${job.company ? ` (${job.company})` : ''}`);
    console.log(`   ${job.url}`);
    result.reasons?.forEach((r) => console.log(`   + ${r}`));
    result.gaps?.forEach((r) => console.log(`   - gap: ${r}`));
    result.red_flags?.forEach((r) => console.log(`   ! ${r}`));
    if (result.why) console.log(`   Чому не вище: ${result.why}`);
    if (result.score >= config.threshold) hits.push({ job, result });
  } catch (e) {
    console.error(`[match] ${job.title}: ${e.message}`); // не зберігаємо, спробуємо наступного разу
  }
}

const format = ({ job, result }) =>
  [
    `${result.score}% ${job.title}`,
    ...(result.reasons ?? []).map((r) => `+ ${r}`),
    ...(result.gaps ?? []).map((r) => `- gap: ${r}`),
    ...(result.red_flags ?? []).map((r) => `! ${r}`),
    result.why ? `Чому не вище: ${result.why}` : '',
    job.url,
  ]
    .filter(Boolean)
    .join('\n');

const file = writeReport(config.threshold);
console.log(`\nСторінка з результатами: ${file}`);

if (hits.length) {
  hits.sort((a, b) => b.result.score - a.result.score);
  try {
    await sendTelegram(`Нових вакансій від ${config.threshold}%: ${hits.length}`);
    for (const h of hits.slice(0, MAX_MESSAGES)) await sendTelegram(format(h));
    if (hits.length > MAX_MESSAGES) await sendTelegram(`...і ще ${hits.length - MAX_MESSAGES} у звіті`);
    await sendTelegramDocument(file, 'Усі оцінені вакансії: відкрий файл у браузері');
  } catch (e) {
    // збій Telegram не має ламати запуск: інакше база не збережеться і все оцінюватиметься знову
    console.error(`[telegram] ${e.message}`);
  }
} else {
  console.log('Нічого від порогу.');
}

if (process.platform === 'darwin' && !process.env.NO_OPEN) exec(`open ${file}`);
