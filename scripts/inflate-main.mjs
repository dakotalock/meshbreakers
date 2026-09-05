import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/mainParts");
const files = readdirSync(dir).filter((f) => /^\d{2}\.b64$/.test(f)).sort();
if (!files.length) throw new Error("src/mainParts/*.b64 missing");
let b64 = files.map((f) => readFileSync(join(dir, f), "utf8").trim()).join("");
// Repair two transcription nicks from chunked MCP upload.
b64 = b64.replace("FNIKLmRMbbXyX0", "FNIKLmRBagbXyX0");
b64 = b64.replace("GY9yinyxbWLHJX", "GY9yivyxbWLHJX");
const out = gunzipSync(Buffer.from(b64, "base64"));
writeFileSync(join(root, "src/main.ts"), out);
console.log("inflated src/main.ts", out.length, "from", files.length, "parts");
