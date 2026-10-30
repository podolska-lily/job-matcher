import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

// Дешевий відсів без API: назва і локація
export function prefilter(job, f) {
  const title = job.title.toLowerCase();
  const loc = `${job.location} ${job.description.slice(0, 500)}`.toLowerCase();
  if (f.titleInclude?.length && !f.titleInclude.some((k) => title.includes(k))) return false;
  if (f.titleExclude?.some((k) => title.includes(k))) return false;
  if (f.locationInclude?.length && job.location && !f.locationInclude.some((k) => loc.includes(k))) return false;
  return true;
}

const SYSTEM = `Ти допомагаєш кандидату відбирати вакансії. Порівняй резюме з вакансією за заданими критеріями.
Будь суворим: 90+ ставь лише коли роль, рівень, домен і локація реально збігаються.
Відповідай ТІЛЬКИ JSON без markdown:
{"score": 0-100, "reasons": ["..."], "gaps": ["..."], "why": "...", "red_flags": ["..."]}
reasons: до 3 коротких причин, чому вакансія підходить.
gaps: до 3 конкретних розривів між вакансією і резюме у форматі "вимога вакансії -> що в резюме (немає / слабко / інший стек)". Лише реальні розбіжності, нічого не вигадуй.
why: одне коротке речення, чому оцінка не вища (що саме її знизило). Якщо оцінка 90+, напиши "суттєвих розривів немає".
red_flags: до 3 критичних проблем (формат роботи, мова, стек, країна). Порожній список, якщо їх немає.
Усі тексти українською, коротко.`;

export async function scoreJob(job, resume, criteria) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          `<resume>\n${resume}\n</resume>\n<criteria>\n${criteria}\n</criteria>\n` +
          `<job>\nНазва: ${job.title}\nКомпанія: ${job.company}\nЛокація: ${job.location}\n` +
          `${job.description.slice(0, 6000)}\n</job>`,
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
