// Usage: node scripts/test-voice-api.mjs <path-to-audio-file>
// Example: node scripts/test-voice-api.mjs ~/Desktop/memo.m4a
//
// Set these before running:
const TOKEN    = process.env.VOICE_TOKEN ?? "paste-your-raw-token-here";
const ORG_SLUG = process.env.ORG_SLUG   ?? "your-org-slug";
const BASE_URL = process.env.BASE_URL   ?? "http://localhost:3000";

import { readFileSync } from "fs";
import { resolve, basename } from "path";

const audioPath = process.argv[2];
if (!audioPath) {
  console.error("Usage: node scripts/test-voice-api.mjs <path-to-audio-file>");
  process.exit(1);
}

const filePath = resolve(audioPath);
const fileBuffer = readFileSync(filePath);
const fileName = basename(filePath);
const mimeType = fileName.endsWith(".mp3") ? "audio/mpeg"
               : fileName.endsWith(".wav") ? "audio/wav"
               : "audio/mp4"; // covers .m4a

const form = new FormData();
form.append("audio", new File([fileBuffer], fileName, { type: mimeType }));

console.log(`Sending ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB) to ${BASE_URL}/api/voice-tasks …\n`);

const res = await fetch(`${BASE_URL}/api/voice-tasks`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "X-Org-Slug": ORG_SLUG,
  },
  body: form,
});

const text = await res.text();
console.log(`Status: ${res.status}\n`);
console.log(text);
