// 배경 이미지 생성 (OpenAI) → public/bg/*.webp
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = readFileSync(join(root, ".env.local"), "utf8").match(/^OPENAI_API_KEY=(.+)$/m)[1].trim();
const OUT = join(root, "public", "bg");
mkdirSync(OUT, { recursive: true });

const BGS = {
  main: `Epic cinematic wide panorama of ancient Chinese Three Kingdoms battlefield at dusk. Massive armies with countless war banners (red, green, gold) facing each other across a misty river valley, dramatic burning sunset sky, silhouetted mountain fortress, embers floating in the air. Painterly digital art, dark moody atmosphere with deep shadows at top and bottom edges for UI overlay. No text, no watermark.`,
  rtk2: `Ancient Chinese war council room seen from above a giant aged parchment map of China on a wooden table, lit by candlelight. Brush-stroke province borders, small carved wooden army markers and flags on the map, ink brush and seal nearby, smoke wisps. Warm dark tones, painterly digital art, dark vignette edges for UI overlay. No text, no watermark.`,
};

for (const [name, prompt] of Object.entries(BGS)) {
  process.stdout.write(`${name} ... `);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
      quality: "high",
      output_format: "webp",
      output_compression: 80,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`실패: ${JSON.stringify(data.error ?? data).slice(0, 200)}`);
    continue;
  }
  const buf = Buffer.from(data.data[0].b64_json, "base64");
  writeFileSync(join(OUT, `${name}.webp`), buf);
  console.log("OK", Math.round(buf.length / 1024) + "KB");
}
