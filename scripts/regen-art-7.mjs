// 구모델(gpt-image-1)로 생성된 7장을 표준 설정(gpt-image-2 + low + webp)으로 재생성
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = readFileSync(join(root, ".env.local"), "utf8").match(/^OPENAI_API_KEY=(.+)$/m)[1].trim();
const OUT = join(root, "public", "art");

const STYLE = `Epic fantasy trading card game character portrait from Romance of the Three Kingdoms.
Painterly digital illustration, dramatic rim lighting, rich saturated colors, detailed ancient Chinese armor and clothing, atmospheric background with soft depth of field. Bust portrait, character centered, heroic expression. No text, no watermark, no border.`;

const G = {
  관우: "Guan Yu — long flowing black beard, green and gold ornate armor, holding the Green Dragon Crescent Blade, solemn dignified expression, misty mountain pass behind",
  여포: "Lü Bu — the mightiest warrior, crimson-plumed golden headdress with two long pheasant feathers, red cape, wielding a halberd, arrogant fierce eyes, burning battlefield behind",
  제갈량: "Zhuge Liang — serene strategist in white and teal robes, holding a crane feather fan, wise calm gaze, star chart and war camp behind",
  조조: "Cao Cao — ambitious warlord in dark purple court robes with gold dragon trim, sharp cunning eyes, short beard, palace hall with banners behind",
  주유: "Zhou Yu — handsome young commander, crimson and gold naval armor, elegant confident smile, river fleet with fire ships glowing behind",
  유비: "Liu Bei — benevolent lord, gentle yet resolute face, long ears, green and gold robes, twin swords at his back, warm sunrise behind",
  장비: "Zhang Fei — wild black beard, leopard eyes, roaring expression, dark crimson armor, serpent spear, thunderclouds behind",
};

for (const [name, desc] of Object.entries(G)) {
  process.stdout.write(`${name} ... `);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: `${STYLE}\n\nCharacter: ${desc}`,
        n: 1,
        size: "1024x1536",
        quality: "low",
        output_format: "webp",
        output_compression: 80,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 150)}`);
    writeFileSync(join(OUT, `${name}.webp`), Buffer.from(data.data[0].b64_json, "base64"));
    const png = join(OUT, `${name}.png`);
    if (existsSync(png)) unlinkSync(png); // 구모델 PNG 제거 (webp가 우선 로드됨)
    console.log("OK");
  } catch (e) {
    console.log("실패:", e.message);
    if (String(e.message).includes("429")) await new Promise((r) => setTimeout(r, 20000));
  }
  await new Promise((r) => setTimeout(r, 1500));
}
console.log("재생성 완료");
