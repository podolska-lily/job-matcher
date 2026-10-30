# job-matcher

A small bot that checks [DOU](https://jobs.dou.ua/vacancies/?category=QA) for QA jobs abroad twice a day, scores every new vacancy against my resume with Claude, explains the gaps, and delivers the best matches to Telegram plus a filterable HTML report with apply links.

Built to replace the daily routine of scrolling job boards and mentally comparing each posting to my CV.

## What it does

1. **Collects** vacancies from DOU's RSS feed (QA category, "abroad" filter).
2. **Pre-filters** by title and location, so only plausible roles reach the model (cheap, no API call).
3. **Scores** each remaining vacancy with Claude: the resume, my criteria and the job text go in, a JSON verdict comes out:
   - `score` (0-100)
   - `reasons` (why it fits)
   - `gaps` (requirement in the job -> what the resume has, or lacks)
   - `why` (one sentence on what lowered the score)
   - `red_flags` (work format, language, stack, country)
4. **Remembers** what it has already seen in SQLite (`jobs.db`), so nothing is scored or sent twice.
5. **Delivers** results above a threshold (75 by default):
   - one Telegram message per vacancy, with the link to apply;
   - `report.html`, a single self-contained page: sorted cards, min-score slider, search, and "applied / skipped" marks.
6. **Runs on a schedule** with GitHub Actions and commits the updated `jobs.db` back to the repo.

## See the result without any keys

The database of scored vacancies is in the repo, so you can build the report locally. No API key or `npm install` needed.

```bash
git clone https://github.com/podolska-lily/job-matcher.git
cd job-matcher
node src/report.js
open report.html        # macOS; on other systems just open the file in a browser
```

Requires Node 22.13 or newer (uses the built-in `node:sqlite`). Node may print an "ExperimentalWarning" about SQLite; it is harmless.

Run history and logs of the scheduled job are on the [Actions tab](../../actions).

## Run your own copy

1. Fork the repo and clone it.
2. Replace `resume.txt` with your own resume (plain text, English works best) and edit `config.json`:

   | Field | Meaning |
   |---|---|
   | `threshold` | minimum score to notify about |
   | `criteria` | free-text description of the role you want and what is a deal breaker; the model reads this |
   | `filters.titleInclude` / `titleExclude` | keywords for the cheap pre-filter |
   | `filters.locationInclude` | location keywords (applied only when the feed gives a location) |
   | `dou.feedUrls` | DOU RSS feed URLs; apply the filters on the site, copy the RSS link |

3. Create a Telegram bot with [@BotFather](https://t.me/BotFather), message it once, and get your chat id from `https://api.telegram.org/bot<TOKEN>/getUpdates`.
4. In the fork: Settings -> Secrets and variables -> Actions, add:
   - `ANTHROPIC_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Open the Actions tab, enable workflows for the fork, and run **Job matcher** manually. Delete `jobs.db` first if you want a clean start.

Local run: `npm install`, put the three variables in a `.env` file, then `npm start`. The report opens automatically on macOS.

The model can be changed with the `CLAUDE_MODEL` environment variable.

## Project layout

```
src/collectors.js   fetches and normalises the DOU RSS feed
src/matcher.js      pre-filter + Claude scoring (JSON output)
src/db.js           SQLite storage (built-in node:sqlite)
src/report.js       generates report.html from the database
src/notify.js       Telegram messages and file upload
src/index.js        orchestration
.github/workflows/jobs.yml   schedule (06:00 and 15:00 UTC) + persistence of jobs.db
```

## Limitations

- Only DOU is supported so far; other sources would be new modules in `collectors.js`.
- The percentage is a model estimate against my stated criteria, not an objective number. It needs calibration against your own judgement (the "gaps" and "why" lines are there for that).
- The repo contains my own `resume.txt`, `config.json` and job history on purpose. Replace them if you fork.
- Each scored vacancy is one API call; a typical run costs very little, but it is not free.
