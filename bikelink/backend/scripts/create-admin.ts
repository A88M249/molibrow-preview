// Creates (or recovers) an owner account for the back-office.
//   npm run admin:create -- you@bikelink.no "Your Name"        (asks for the password, hidden)
//   ADMIN_PASSWORD=... npm run admin:create -- you@bikelink.no  (non-interactive)
//   add --reset-2fa to also remove the authenticator (lost phone); it is set up again at the next login.
// Needs DATABASE_URL (and JWT_SECRET is not required here). Run it against the production database with e.g. `railway run npm run admin:create -- ...`.
import { createInterface } from "node:readline";
import pg from "pg";
import { passwordProblem } from "../src/admin-auth.js";
import { hashPassword } from "../src/auth.js";

const args = process.argv.slice(2);
const reset2fa = args.includes("--reset-2fa");
const [email, name] = args.filter((a) => !a.startsWith("--"));
if (!email || !/^\S+@\S+\.\S+$/.test(email)) { console.error('Usage: npm run admin:create -- you@example.com ["Your Name"] [--reset-2fa]'); process.exit(1); }

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (s: string) => (s.includes(prompt) ? out(s) : true); // hide what is typed
    rl.question(prompt, (a) => { (process.stdout as { write: unknown }).write = out; out("\n"); rl.close(); resolve(a); });
  });
}

let password = process.env.ADMIN_PASSWORD ?? "";
if (!password) {
  password = await ask("Password (min 12 characters): ");
  if (password !== (await ask("Repeat password: "))) { console.error("The passwords differ."); process.exit(1); }
}
const problem = passwordProblem(password, email);
if (problem) { console.error(problem); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows: [u] } = await pool.query(
  `INSERT INTO admin_users (email, name, role, password_hash) VALUES ($1,$2,'owner',$3)
   ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = 'owner', disabled = false, failed_attempts = 0, locked_until = NULL, session_version = admin_users.session_version + 1,
     name = COALESCE($2, admin_users.name)${reset2fa ? ", totp_secret_enc = NULL, totp_enabled = false, totp_last_step = 0, recovery_hashes = '{}'" : ""}
   RETURNING id, totp_enabled`, [email.toLowerCase(), name ?? null, await hashPassword(password)]);
await pool.end();
console.log(`✓ Owner ${email} is ready${u.totp_enabled ? "" : " – two-factor will be set up at the first login (have your authenticator app ready)"}.`);
