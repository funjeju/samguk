// 카드 초상 일괄 생성 스크립트 (Gemini 이미지 API)
// 사용법:  node scripts/generate-art.mjs          ← 없는 초상만 생성
//         node scripts/generate-art.mjs guanyu    ← 특정 장수만 재생성
// 결과물: public/art/{generalId}.png  → GeneralCard가 자동으로 사용
// 주의: .env.local의 GEMINI_API_KEY 프로젝트에 결제 크레딧이 있어야 함

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env.local"), "utf8");
const KEY = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!KEY) {
  console.error(".env.local에 GEMINI_API_KEY가 없습니다.");
  process.exit(1);
}

const MODEL = "gemini-3.1-flash-image"; // 품질 더 원하면 imagen-4.0-generate-001로 교체
const OUT_DIR = join(root, "public", "art");
mkdirSync(OUT_DIR, { recursive: true });

// 아트 일관성: 모든 카드에 동일한 스타일 프리픽스 (GDD §7 "스타일 프롬프트 고정")
const STYLE = `Epic fantasy trading card game character portrait, Romance of the Three Kingdoms.
Style: painterly digital illustration, dramatic rim lighting, rich saturated colors, detailed ancient Chinese armor and clothing, atmospheric battlefield or court background with soft depth of field.
Composition: bust portrait, character centered, heroic expression, vertical 3:4.
No text, no watermark, no border, no frame.`;

// 장수별 외형 묘사 (id는 lib/roster.ts와 일치해야 함)
const GENERALS = {
  lvbu: "Lü Bu — the mightiest warrior, crimson-plumed golden headdress, red cape, halberd Sky Piercer, arrogant fierce eyes",
  zhugeliang: "Zhuge Liang — serene strategist in white and teal robes, feather fan, blue headband, wise calm gaze",
  guanyu: "Guan Yu — long black beard, green and gold armor, Green Dragon Crescent Blade, solemn dignified expression",
  caocao: "Cao Cao — ambitious warlord in dark purple court robes with gold trim, sharp cunning eyes, short beard",
  sunquan: "Sun Quan — young lord of Jiangdong, purple-red hair tint, regal blue and gold robes, confident gaze",
  zhangfei: "Zhang Fei — wild black beard, roaring expression, dark red armor, serpent spear",
  simayi: "Sima Yi — cold calculating strategist, gray-streaked hair, dark teal robes, faint smirk",
  lvmeng: "Lü Meng — rugged commander in fur-trimmed dark armor, determined eyes, dual origin scholar-warrior",
  liubei: "Liu Bei — benevolent lord, gentle but resolute face, green and gold robes, twin swords",
  zhaoyun: "Zhao Yun — handsome young general in silver-white armor, white-plumed helm, spear, noble gaze",
  machao: "Ma Chao — western splendid armor with lion motif, white cape, spear, fierce vengeful eyes",
  huangzhong: "Huang Zhong — veteran archer with white beard, weathered gold armor, great bow drawn",
  weiyan: "Wei Yan — rebellious fierce general, dark bronze armor, twin axes, defiant scowl",
  pangtong: "Pang Tong — eccentric scholar, plain dark robes, unkempt hair, knowing sly smile",
  jiangwei: "Jiang Wei — young earnest successor strategist-general, green-silver armor, spear and scroll",
  xiahoudun: "Xiahou Dun — one-eyed general with black eyepatch, dark blue armor, podao blade, grim resolve",
  zhangliao: "Zhang Liao — disciplined elite general, blue-steel armor with crescent motifs, glaive",
  xuhuang: "Xu Huang — stern reliable general, iron-gray armor, great battle axe",
  xuchu: "Xu Chu — massive muscular bodyguard, bare arms, huge sword, simple loyal face",
  dianwei: "Dian Wei — hulking guardian with twin halberds, dark leather armor, ferocious loyalty",
  guojia: "Guo Jia — frail young genius advisor, pale complexion, loose dark robes, brilliant piercing eyes",
  xunyu: "Xun Yu — refined noble minister, immaculate white and purple court robes, incense sachet",
  zhouyu: "Zhou Yu — handsome young commander, crimson and gold naval armor, elegant confident smile",
  luxun: "Lu Xun — scholarly young commander in red-gold robes over light armor, calm burning gaze",
  ganning: "Gan Ning — ex-pirate with bells on sash, feather ornaments, wild grin, twin blades",
  taishici: "Taishi Ci — honorable warrior with twin short halberds, bow on back, forthright expression",
  huanggai: "Huang Gai — scarred veteran with iron whip, weathered bronze armor, unbreakable will",
  yuanshao: "Yuan Shao — proud aristocrat warlord, ornate golden armor with fur cloak, haughty bearing",
  dongzhuo: "Dong Zhuo — corpulent tyrant in extravagant dark robes, cruel grin, burning city glow behind",
  lusu: "Lu Su — mild diplomatic statesman, modest green-gray robes, thoughtful gentle face",
};

async function generate(id, desc) {
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`이미지 없음: ${JSON.stringify(data).slice(0, 300)}`);
  writeFileSync(join(OUT_DIR, `${id}.png`), Buffer.from(part.inlineData.data, "base64"));
}

const only = process.argv[2];
const targets = Object.entries(GENERALS).filter(([id]) => (only ? id === only : true));

let ok = 0,
  skip = 0,
  fail = 0;
for (const [id, desc] of targets) {
  const out = join(OUT_DIR, `${id}.png`);
  if (!only && existsSync(out)) {
    skip++;
    continue;
  }
  try {
    process.stdout.write(`${id} ... `);
    await generate(id, desc);
    console.log("OK");
    ok++;
    await new Promise((r) => setTimeout(r, 1500)); // 레이트리밋 완충
  } catch (e) {
    console.log(`실패 — ${e.message}`);
    fail++;
    if (String(e.message).includes("429")) {
      console.error("크레딧/쿼터 문제로 중단합니다. https://ai.studio/projects 에서 결제를 확인하세요.");
      break;
    }
  }
}
console.log(`\n완료: 생성 ${ok} / 스킵 ${skip} / 실패 ${fail}`);
