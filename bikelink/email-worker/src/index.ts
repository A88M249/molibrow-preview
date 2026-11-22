import PostalMime from "postal-mime";

export interface Env {
  API_URL: string;
  STOCK_INGEST_TOKEN: string;
  FALLBACK_ADDRESS?: string;
}

const toBase64 = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * Email Routing → this Worker. The daily stock mail from MMR is parsed here and its CSV attachment is sent to the API
 * (POST /ingest/stock), which checks sender + token, shows a preview and applies it (see STOCK_AUTO_APPLY).
 * Anything that is not a stock file, or any temporary failure, is forwarded to FALLBACK_ADDRESS instead of being lost.
 */
export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const forward = async (why: string) => {
      if (env.FALLBACK_ADDRESS) { await message.forward(env.FALLBACK_ADDRESS); console.log(`forwarded: ${why}`); }
      else message.setReject(`Could not process this message (${why})`);
    };

    const mail = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
    const files = mail.attachments.filter((a) => /\.csv$/i.test(a.filename ?? "") || /^text\/(csv|comma-separated-values)$/i.test(a.mimeType));
    if (!files.length) return forward("no CSV attachment");

    const from = mail.from?.address ?? message.from;
    for (const f of files) {
      let res: Response;
      try {
        res = await fetch(`${env.API_URL}/ingest/stock`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.STOCK_INGEST_TOKEN}` },
          body: JSON.stringify({
            filename: f.filename ?? "stock.csv",
            from,
            receivedAt: mail.date ? new Date(mail.date).toISOString() : undefined,
            csvBase64: toBase64(f.content),
          }),
        });
      } catch (e) { return forward(`API unreachable: ${(e as Error).message}`); }
      console.log(`${f.filename}: ${res.status} ${await res.text()}`);
      if (res.status === 403) return message.setReject("Sender not allowed");   // not from an approved MMR address
      if (res.status >= 500 || res.status === 401) return forward(`API error ${res.status}`);
      // 202 = stored (pending approval or applied); 422 = unreadable file, recorded as failed and reported to staff by email
    }
  },
};
