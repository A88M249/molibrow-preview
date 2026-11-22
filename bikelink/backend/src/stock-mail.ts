import { simpleParser } from "mailparser";

export type StockMail = { from: string; date: Date | null; files: { filename: string; content: Buffer }[] };

/** Pulls the sender, date and CSV attachments out of a raw email (RFC 822). */
export async function csvAttachmentsFrom(raw: Buffer): Promise<StockMail> {
  const mail = await simpleParser(raw);
  const files = (mail.attachments ?? [])
    .filter((a) => /\.csv$/i.test(a.filename ?? "") || /^text\/(csv|comma-separated-values)$/i.test(a.contentType) || (/excel|octet-stream/i.test(a.contentType) && /\.csv$/i.test(a.filename ?? "")))
    .map((a) => ({ filename: a.filename ?? "stock.csv", content: a.content }));
  return { from: mail.from?.value?.[0]?.address ?? "", date: mail.date ?? null, files };
}
