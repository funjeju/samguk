// 중국 지형 지도 배경 생성 → public/bg/chinamap.webp
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = readFileSync(join(root, ".env.local"), "utf8").match(/^OPENAI_API_KEY=(.+)$/m)[1].trim();
mkdirSync(join(root, "public", "bg"), { recursive: true });

const prompt = `Top-down antique painted terrain map of ancient China (Han dynasty era), portrait orientation, covering all of China proper: Liaodong peninsula and Korean bay at top-right, Gobi steppe along the top, Hexi corridor and desert top-left, Sichuan basin ringed by mountains at center-left, Yunnan plateau bottom-left, Yangtze river flowing west-to-east across the middle, Yellow River looping through the north to Bohai gulf, southeastern coastline with river deltas bottom-right, Hainan island at the very bottom. Muted dark ink-and-wash tones (deep browns, dark greens, charcoal), subtle relief shading for mountain ranges, faint river lines, aged silk texture. Dark enough for bright UI markers to stand out. Strictly NO text, NO labels, NO borders, NO icons, NO compass.`;

process.stdout.write("chinamap ... ");
const res = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1536",
    quality: "high",
    output_format: "webp",
    output_compression: 82,
  }),
});
const data = await res.json();
if (!res.ok) {
  console.log("실패:", JSON.stringify(data.error ?? data).slice(0, 200));
  process.exit(1);
}
const buf = Buffer.from(data.data[0].b64_json, "base64");
writeFileSync(join(root, "public", "bg", "chinamap.webp"), buf);
console.log("OK", Math.round(buf.length / 1024) + "KB");
