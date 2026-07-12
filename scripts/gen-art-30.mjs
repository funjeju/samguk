// 장수 초상 30종 추가 (표준: gpt-image-2 + low + webp) → public/art/{한글이름}.webp
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = readFileSync(join(root, ".env.local"), "utf8").match(/^OPENAI_API_KEY=(.+)$/m)[1].trim();
const roster = JSON.parse(readFileSync(join(root, "lib", "roster_full.json"), "utf8"));
const names = new Set(roster.map((r) => r.id));
const OUT = join(root, "public", "art");
mkdirSync(OUT, { recursive: true });

const STYLE = `Epic fantasy trading card game character portrait from Romance of the Three Kingdoms.
Painterly digital illustration, dramatic rim lighting, rich saturated colors, detailed ancient Chinese armor and clothing, atmospheric background with soft depth of field. Bust portrait, character centered, heroic expression. No text, no watermark, no border.`;

const G = {
  서서: "Xu Shu — wandering scholar-swordsman, plain gray traveling robes with a sword, filial sorrowful but brilliant eyes",
  법정: "Fa Zheng — sharp vindictive strategist, dark red and black robes, thin face with cunning smile",
  마량: "Ma Liang — gentle wise advisor with distinctive white eyebrows, green scholar robes, serene expression",
  마속: "Ma Su — confident young strategist, blue-green robes with map scrolls, bright but overreaching gaze",
  왕평: "Wang Ping — steady illiterate-but-wise general, practical iron armor, calm watchful mountain-guard bearing",
  요화: "Liao Hua — long-serving loyal veteran, worn green armor, weathered determined face",
  마대: "Ma Dai — reliable desert cavalry general, western-style armor with scarf, resolute quiet loyalty",
  관평: "Guan Ping — upright adopted son of Guan Yu, young earnest face, green armor, guandao at rest",
  엄안: "Yan Yan — proud old general of Shu gates, white beard, heavy axe, unbending dignity",
  이엄: "Li Yan — capable but ambitious administrator-general, ornate bronze armor over official robes",
  제갈근: "Zhuge Jin — tall mild diplomat with a long face, elegant dark blue Wu court robes, patient wisdom",
  장소: "Zhang Zhao — stern senior statesman of Wu, gray beard, black and gold court robes, uncompromising gaze",
  고옹: "Gu Yong — silent meticulous Wu chancellor, plain dark robes, composed unreadable face",
  서성: "Xu Sheng — stalwart Wu defender, naval armor with cloak, standing firm against northern wind",
  정봉: "Ding Feng — veteran Wu general famous for snow raid, fur-trimmed armor, short spear, fearless grin",
  반장: "Pan Zhang — fierce and greedy Wu general, dark armor with trophies, predatory eyes",
  주환: "Zhu Huan — proud brilliant young Wu commander, crimson-silver armor, defiant confidence",
  주연: "Zhu Ran — steadfast Wu general, dark naval armor, calm under siege, burning arrows behind",
  진궁: "Chen Gong — principled strategist who chose his own path, gray-blue robes, resolute tragic dignity",
  고순: "Gao Shun — silent elite commander of the Formation Breakers, black lacquered armor, ascetic discipline",
  전풍: "Tian Feng — blunt honest advisor, coarse dark robes, prison chains motif, unbowed integrity",
  저수: "Ju Shou — loyal doomed strategist, gray robes with star chart, melancholy foresight",
  심배: "Shen Pei — die-hard loyal administrator, dark iron armor over robes, defiant to the last wall",
  이각: "Li Jue — brutal warlord of the ruined capital, ragged gilded armor, paranoid cruel eyes",
  왕윤: "Wang Yun — scheming old minister, formal Han court robes, weary righteous determination",
  채모: "Cai Mao — naval commander of Jing province, scale armor with water motifs, calculating opportunist",
  괴월: "Kuai Yue — shrewd Jing province strategist, deep green robes, half-lidded knowing eyes",
  문빙: "Wen Ping — dependable Jing defender, plain sturdy armor, honest storm-watching face",
  황조: "Huang Zu — stubborn old river warlord, outdated ornate armor, arrogant scowl, river fortress behind",
  학소: "Hao Zhao — indomitable fortress defender, gray siege-worn armor, torch light, immovable will",
};

let ok = 0, skip = 0, fail = 0;
for (const [name, desc] of Object.entries(G)) {
  if (!names.has(name)) {
    console.log(name, "— 로스터에 없음, 스킵");
    continue;
  }
  const out = join(OUT, `${name}.webp`);
  if (existsSync(out)) {
    skip++;
    continue;
  }
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
    writeFileSync(out, Buffer.from(data.data[0].b64_json, "base64"));
    ok++;
    console.log("OK");
  } catch (e) {
    fail++;
    console.log("실패:", e.message);
    if (String(e.message).includes("429")) await new Promise((r) => setTimeout(r, 20000));
  }
  await new Promise((r) => setTimeout(r, 1200));
}
console.log(`완료: 생성 ${ok} / 스킵 ${skip} / 실패 ${fail}`);
