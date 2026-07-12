// 장수 초상 50종 추가 (표준: gpt-image-2 + low + webp) → public/art/{로스터ID}.webp
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
  // 위
  조인: "Cao Ren — iron-willed defensive general of Wei, heavy dark blue plate armor, scarred stern face, fortress walls behind",
  조홍: "Cao Hong — wealthy loyal cavalry general of Wei, ornate gilded armor, bold reckless grin",
  조비: "Cao Pi — first emperor of Wei, black and gold imperial robes over light armor, cold calculating elegance",
  조진: "Cao Zhen — stout senior Wei commander, massive ornate armor, proud bullish confidence",
  조휴: "Cao Xiu — dashing Wei cavalry commander of the clan, crimson-trimmed armor, sharp ambitious eyes",
  "조창(조장)": "Cao Zhang — yellow-bearded warrior prince of Wei, tiger-motif armor, fierce love of battle",
  "조식(조삭)": "Cao Zhi — brilliant melancholy poet-prince of Wei, flowing white and jade scholar robes, wine cup and verse scrolls",
  등애: "Deng Ai — brilliant Wei general who crossed the impassable mountains, weathered practical armor, terrain map, indomitable resolve",
  종회: "Zhong Hui — ambitious young Wei strategist-general, immaculate silver-purple armor, arrogant brilliant gaze",
  "곽회(곽준)": "Guo Huai — steady Wei defender of the west, sand-worn gray armor, patient watchful frontier eyes",
  진태: "Chen Tai — capable Wei frontier commander, dark green armor with fur cloak, calm tactical poise",
  왕쌍: "Wang Shuang — giant Wei champion with meteor hammer, hulking black armor, brutal confident sneer",
  학소: "Hao Zhao — indomitable fortress defender of Chencang, gray siege-worn armor, torch light on the ramparts, immovable will",
  하후패: "Xiahou Ba — Wei general who defected to Shu, mixed blue-green armor, conflicted determined veteran face",
  만총: "Man Chong — shrewd Wei administrator-general, plain dark official armor, torchlit siege defense, unshakable calm",
  유엽: "Liu Ye — ingenious Wei advisor of Han royal blood, deep purple scholar robes, siege engine blueprints, quiet brilliance",
  진군: "Chen Qun — refined Wei statesman and lawmaker, formal black-gold court robes, composed authoritative dignity",
  제갈탄: "Zhuge Dan — proud Wei general who rebelled at Shouchun, battle-worn crimson armor, defiant tragic resolve",
  사마사: "Sima Shi — cold ruthless elder Sima heir, black armor with silver trim, piercing single-minded gaze, terrifying composure",
  사마소: "Sima Zhao — cunning younger Sima brother, dark robes over lamellar armor, half-smile of open ambition",
  // 촉
  관흥: "Guan Xing — young heir of Guan Yu, green armor with dragon motifs, solemn burning vengeance, guandao in hand",
  장포: "Zhang Bao — fiery heir of Zhang Fei, black spiked armor, serpent spear, roaring fighting spirit",
  유선: "Liu Shan — gentle naive emperor of Shu, soft imperial green-gold robes, mild innocent round face",
  유봉: "Liu Feng — adopted son of Liu Bei, sturdy green-bronze armor, capable but doomed prideful youth",
  맹달: "Meng Da — opportunistic turncoat general, elegant mixed-style armor, shifting untrustworthy eyes",
  맹획: "Meng Huo — wild southern king, exotic tribal armor with feathers and beast pelts, defiant boisterous laugh",
  마충: "Ma Zhong — dependable Shu general of the south, practical rattan-trimmed armor, honest steady gaze",
  등지: "Deng Zhi — fearless Shu diplomat-general, modest green robes with light armor, calm before a boiling cauldron",
  "비의(비위)": "Fei Yi — genial brilliant Shu chancellor, relaxed green court robes, warm smile hiding sharp mind",
  장완: "Jiang Wan — magnanimous steady Shu regent, plain dark green robes, unhurried deep composure",
  주창: "Zhou Cang — devoted dark-faced bearer of Guan Yu's blade, bare muscled arms, carrying the green dragon glaive",
  이적: "Yi Ji — witty loyal Shu envoy, light gray-green traveling robes, quick clever humble smile",
  // 오
  한당: "Han Dang — veteran Wu general of three generations, weathered red-bronze armor, bow and blade, grizzled loyalty",
  진무: "Chen Wu — fierce Wu vanguard general, dark crimson armor, ferocious charge, tragic valor",
  서성: "Xu Sheng — stalwart Wu defender, naval armor with cloak, standing firm against northern wind",
  정봉: "Ding Feng — veteran Wu general famous for snow raid, fur-trimmed armor, short spear, fearless grin",
  주연: "Zhu Ran — steadfast Wu general, dark naval armor, calm under siege, burning arrows behind",
  "주환(주항)": "Zhu Huan — proud brilliant young Wu commander, crimson-silver armor, defiant confidence",
  "반장(번장)": "Pan Zhang — fierce and greedy Wu general, dark armor with trophies, predatory eyes",
  제갈각: "Zhuge Ke — prodigy regent of Wu, ornate teal-gold robes over armor, dazzling arrogant genius",
  장소: "Zhang Zhao — stern senior statesman of Wu, gray beard, black and gold court robes, uncompromising gaze",
  고옹: "Gu Yong — silent meticulous Wu chancellor, plain dark robes, composed unreadable face",
  // 군웅
  진궁: "Chen Gong — principled strategist who chose his own path, gray-blue robes, resolute tragic dignity",
  고순: "Gao Shun — silent elite commander of the Formation Breakers, black lacquered armor, ascetic discipline",
  전풍: "Tian Feng — blunt honest advisor of Yuan Shao, coarse dark robes, prison chains motif, unbowed integrity",
  "저수(조수)": "Ju Shou — loyal doomed strategist of Yuan Shao, gray robes with star chart, melancholy foresight",
  심배: "Shen Pei — die-hard loyal administrator of Ye, dark iron armor over robes, defiant to the last wall",
  이유: "Li Ru — sinister strategist of Dong Zhuo, black-green robes, gaunt face, serpentine cold intellect",
  기령: "Ji Ling — champion general of Yuan Shu, heavy gold-trimmed armor, three-pointed twin-edged blade, brash might",
  장임: "Zhang Ren — loyal marksman-general of Shu gates, dark green ambush armor, crossbow, grim unyielding loyalty",
};

let ok = 0, skip = 0, fail = 0;
for (const [name, desc] of Object.entries(G)) {
  if (!names.has(name)) {
    console.log(name, "— 로스터에 없음, 스킵");
    continue;
  }
  const out = join(OUT, `${name}.webp`);
  if (existsSync(out) || existsSync(join(OUT, `${name}.png`))) {
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
