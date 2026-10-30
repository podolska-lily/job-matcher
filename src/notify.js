import { readFileSync } from 'node:fs';

const creds = () => {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  return token && chat ? { token, chat } : null;
};

export async function sendTelegram(text) {
  const c = creds();
  if (!c) {
    console.log('[telegram не налаштований]\n' + text);
    return;
  }
  const r = await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: c.chat, text: text.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
}

export async function sendTelegramDocument(path, caption) {
  const c = creds();
  if (!c) return;
  const form = new FormData();
  form.append('chat_id', c.chat);
  form.append('caption', caption);
  form.append('document', new Blob([readFileSync(path)], { type: 'text/html' }), 'vacancies.html');
  const r = await fetch(`https://api.telegram.org/bot${c.token}/sendDocument`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
}
