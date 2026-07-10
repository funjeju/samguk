// 샘플 5명 카드 초상 생성 → public/art/{한글이름}.png (GeneralCard가 자동 사용)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = readFileSync(join(root, ".env.local"), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const MODEL = "gemini-3.1-flash-image";
const OUT = join(root, "public", "art");
mkdirSync(OUT, { recursive: true });

const STYLE = `Epic fantasy trading card game character portrait, Romance of the Three Kingdoms.
Style: painterly digital illustration, dramatic rim lighting, rich saturated colors, detailed ancient Chinese armor and clothing, atmospheric battlefield or court background with soft depth of field.
Composition: bust portrait, character centered, heroic expression, vertical 3:4.
No text, no watermark, no border, no frame.`;

const SAMPLES = {
  관우: "Guan Yu — long flowing black beard, green and gold ornate armor, holding the Green Dragon Crescent Blade, solemn dignified expression, misty mountain pass behind",
  여포: "Lü Bu — the mightiest warrior, crimson-plumed golden headdress with two long pheasant feathers, red cape, wielding a halberd, arrogant fierce eyes, burning battlefield behind",
  제갈량: "Zhuge Liang — serene strategist in white and teal robes, holding a crane feather fan, wise calm gaze, star chart and war camp behind",
  조조: "Cao Cao — ambitious warlord in dark purple court robes with gold dragon trim, sharp cunning eyes, short beard, palace hall with banners behind",
  주유: "Zhou Yu — handsome young commander, crimson and gold naval armor, elegant confident smile, river fleet with fire ships glowing behind",
};

for (const [name, desc] of Object.entries(SAMPLES)) {
  const out = join(OUT, `${name}.png`);
  if (existsSync(out)) {
    console.log(name, "이미 있음 — 스킵");
    continue;
  }
  process.stdout.write(`${name} ... `);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE}\n\nCharacter: ${desc}` }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    console.log(`실패 (HTTP ${res.status}): ${JSON.stringify(data.error ?? data).slice(0, 200)}`);
    if (res.status === 429) break;
    continue;
  }
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) {
    console.log("이미지 없음:", JSON.stringify(data).slice(0, 150));
    continue;
  }
  writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
  console.log("OK");
  await new Promise((r) => setTimeout(r, 1500));
}
