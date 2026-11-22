/**
 * Polls a mailbox for the daily stock email from MMR and feeds the CSV into the same pipeline as every other source.
 * Run it on a schedule (e.g. Railway cron every 30 minutes):  npm run stock:poll
 *
 * Only messages from STOCK_ALLOWED_SENDERS are touched; everything else in the mailbox is left exactly as it is.
 * Handled messages are marked as read and moved to IMAP_PROCESSED_MAILBOX.
 */
import { ImapFlow } from "imapflow";
import { config } from "./config.js";
import { pool } from "./db.js";
import { csvAttachmentsFrom } from "./stock-mail.js";
import { ingestStockFile, senderAllowed } from "./stock-import.js";

const env = (k: string, d?: string) => { const v = process.env[k] ?? d; if (!v) throw new Error(`Missing env var ${k}`); return v; };

async function main() {
  if (!config.stock.allowedSenders.length) throw new Error("STOCK_ALLOWED_SENDERS must list who may send stock files.");
  const processed = process.env.IMAP_PROCESSED_MAILBOX ?? "Lager-behandlet";
  const client = new ImapFlow({ host: env("IMAP_HOST"), port: Number(process.env.IMAP_PORT ?? 993), secure: true, auth: { user: env("IMAP_USER"), pass: env("IMAP_PASSWORD") }, logger: false });
  await client.connect();
  const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX ?? "INBOX");
  let handled = 0;
  try {
    // collect first: IMAP commands must not be issued while iterating a fetch
    const uids = (await client.search({ seen: false })) || [];
    for (const uid of uids) {
      const msg = await client.fetchOne(String(uid), { source: true, internalDate: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const mail = await csvAttachmentsFrom(msg.source);
      if (!senderAllowed(mail.from)) continue;           // not ours: do not touch
      if (!mail.files.length) continue;                  // from MMR but no CSV (newsletter, reply …): leave for a human
      for (const f of mail.files) {
        const r = await ingestStockFile({ content: f.content, filename: f.filename, source: "email", sender: mail.from, asOf: mail.date ?? (msg.internalDate ? new Date(msg.internalDate) : new Date()), autoApply: config.stock.autoApply });
        console.log(`${f.filename}: ${r.status} – ${r.message}`);
      }
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      try { await client.mailboxCreate(processed); } catch { /* exists */ }
      await client.messageMove(String(uid), processed, { uid: true });
      handled++;
    }
  } finally { lock.release(); await client.logout(); }
  console.log(`Done. ${handled} stock email(s) handled.`);
}

main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
