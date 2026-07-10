// 샘플 카드 초상 생성 (OpenAI 이미지 API) → public/art/{한글이름}.png
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = readFileSync(join(root, ".env.local"), "utf8").match(/^OPENAI_API_KEY=(.+)$/m)[1].trim();
const OUT = join(root, "public", "art");
mkdirSync(OUT, { recursive: true });

const STYLE = `Epic fantasy trading card game character portrait from Romance of the Three Kingdoms.
Painterly digital illustration, dramatic rim lighting, rich saturated colors, detailed ancient Chinese armor and clothing, atmospheric background with soft depth of field. Bust portrait, character centered, heroic expression. No text, no watermark, no border.`;

const SAMPLES = {
  관우: "Guan Yu — long flowing black beard, green and gold ornate armor, holding the Green Dragon Crescent Blade, solemn dignified expression, misty mountain pass behind",
  여포: "Lü Bu — the mightiest warrior, crimson-plumed golden headdress with two long pheasant feathers, red cape, wielding a halberd, arrogant fierce eyes, burning battlefield behind",
  제갈량: "Zhuge Liang — serene strategist in white and teal robes, holding a crane feather fan, wise calm gaze, star chart and war camp behind",
  조조: "Cao Cao — ambitious warlord in dark purple court robes with gold dragon trim, sharp cunning eyes, short beard, palace hall with banners behind",
  주유: "Zhou Yu — handsome young commander, crimson and gold naval armor, elegant confident smile, river fleet with fire ships glowing behind",
};

async function gen(model, name, desc) {
  const body = {
    model,
    prompt: `${STYLE}\n\nCharacter: ${desc}`,
    n: 1,
    size: "1024x1536", // 세로 카드 비율
  };
  if (model === "dall-e-3") body.size = "1024x1792";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 200)}`);
  const item = data.data[0];
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  const img = await fetch(item.url);
  return Buffer.from(await img.arrayBuffer());
}

let model = "gpt-image-1";
for (const [name, desc] of Object.entries(SAMPLES)) {
  const out = join(OUT, `${name}.png`);
  if (existsSync(out)) {
    console.log(name, "이미 있음 — 스킵");
    continue;
  }
  process.stdout.write(`${name} (${model}) ... `);
  try {
    const buf = await gen(model, name, desc);
    writeFileSync(out, buf);
    console.log("OK", Math.round(buf.length / 1024) + "KB");
  } catch (e) {
    console.log("실패:", e.message);
    if (model === "gpt-image-1" && /model|verif|403|404/.test(e.message)) {
      model = "dall-e-3";
      console.log("→ dall-e-3로 전환, 재시도");
      try {
        const buf = await gen(model, name, desc);
        writeFileSync(out, buf);
        console.log(name, "OK", Math.round(buf.length / 1024) + "KB");
      } catch (e2) {
        console.log("재시도 실패:", e2.message);
      }
    }
  }
}
console.log("완료");
