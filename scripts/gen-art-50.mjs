// 장수 초상 50종 추가 생성 (OpenAI gpt-image-1, WebP) → public/art/{한글이름}.webp
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
  유비: "Liu Bei — benevolent lord, gentle yet resolute face, long ears, green and gold robes, twin swords at his back, warm sunrise behind",
  장비: "Zhang Fei — wild black beard, leopard eyes, roaring expression, dark crimson armor, serpent spear, thunderclouds behind",
  조운: "Zhao Yun — handsome young general in gleaming silver-white armor, white-plumed helm, long spear, calm noble gaze",
  마초: "Ma Chao — splendid white and silver armor with lion motif, white cape, long spear, fierce vengeful eyes, desert wind",
  황충: "Huang Zhong — veteran archer with flowing white beard, weathered gold armor, great bow drawn taut, sharp eagle eyes",
  위연: "Wei Yan — rebellious fierce general, dark bronze armor, heavy blade, defiant scowl, mountain pass behind",
  방통: "Pang Tong — eccentric homely scholar, plain dark robes, unkempt hair, knowing sly smile, phoenix motif behind",
  강유: "Jiang Wei — earnest young general-strategist, green-silver armor, spear in one hand scroll in the other",
  손견: "Sun Jian — the Tiger of Jiangdong, red-bronze armor with tiger pelt, ancient blade, ferocious charisma",
  손책: "Sun Ce — the Little Conqueror, young and dashing, crimson armor, twin-tasseled spear, fearless grin",
  손권: "Sun Quan — young lord with purple-tinted hair and green eyes, regal blue and gold robes, confident gaze, river fleet behind",
  육손: "Lu Xun — scholarly young commander in red-gold robes over light armor, calm burning gaze, fire reflections",
  여몽: "Lü Meng — rugged self-made commander, fur-trimmed dark armor, determined eyes, war journal at his belt",
  노숙: "Lu Su — mild diplomatic statesman, modest green-gray robes, thoughtful gentle face, map scroll in hands",
  감녕: "Gan Ning — ex-pirate with bells on red sash, feather ornaments, wild grin, twin blades, river mist",
  태사자: "Taishi Ci — honorable warrior with twin short halberds, great bow on back, forthright expression",
  황개: "Huang Gai — scarred veteran with iron whip, weathered bronze armor, unbreakable will, burning ships behind",
  정보: "Cheng Pu — dignified senior Wu commander, ornate iron-snake spear, composed veteran bearing",
  주태: "Zhou Tai — scarred bodyguard general, body covered in battle scars, dark naval armor, silent loyalty",
  능통: "Ling Tong — young hot-blooded Wu officer, light agile armor, dual blades, spirited expression",
  하후돈: "Xiahou Dun — one-eyed general with black eyepatch, dark blue armor, podao blade, grim iron resolve",
  하후연: "Xiahou Yuan — swift raider general, light blue-steel armor, bow and quiver, hawk-like alertness",
  장료: "Zhang Liao — disciplined elite general, blue-steel armor with crescent motifs, glaive, calm menace",
  서황: "Xu Huang — stern reliable general, iron-gray armor, massive battle axe, disciplined stance",
  악진: "Yue Jin — small but fearless vanguard general, compact sturdy armor, short blade, first-over-the-wall spirit",
  우금: "Yu Jin — strict disciplinarian general, austere dark armor, banner of iron rules, stern face",
  이전: "Li Dian — scholarly warrior, practical armor with scroll case, thoughtful restrained expression",
  전위: "Dian Wei — hulking guardian with twin halberds, dark leather armor, ferocious loyalty, gate-defending stance",
  허저: "Xu Chu — massive muscular bodyguard, bare arms, huge blade, simple loyal face, tiger-fool aura",
  장합: "Zhang He — graceful tactical general, elegant plumed armor, long spear, refined calculating gaze",
  방덕: "Pang De — grim determined general carrying his own coffin to battle, white-silver armor, axe",
  사마의: "Sima Yi — cold calculating strategist, gray-streaked hair, dark teal robes, faint knowing smirk, shadowed hall",
  곽가: "Guo Jia — frail young genius advisor, pale complexion, loose dark robes, brilliant piercing eyes, wine cup",
  순욱: "Xun Yu — refined noble minister, immaculate white and purple court robes, incense sachet, principled gaze",
  순유: "Xun You — quiet deep strategist, plain gray-blue robes, calm unreadable expression",
  가후: "Jia Xu — survivor strategist, unassuming dark robes, hooded wary eyes, half-shadowed face",
  정욱: "Cheng Yu — tall stern advisor, black and bronze robes, hard pragmatic gaze, mountain fortress behind",
  동탁: "Dong Zhuo — corpulent tyrant in extravagant dark gold robes, cruel grin, burning capital glow behind",
  원소: "Yuan Shao — proud aristocrat warlord, ornate golden armor with fur cloak, haughty noble bearing",
  원술: "Yuan Shu — vain self-proclaimed emperor, gaudy imperial robes over armor, arrogant sneer, jade seal in hand",
  공손찬: "Gongsun Zan — frontier cavalry lord, white horse banner, silver-white armor, long lance, northern steppe",
  도겸: "Tao Qian — kindly aging governor, modest brown-gold robes, tired benevolent face",
  유표: "Liu Biao — scholarly provincial lord, elegant green-black robes, dignified but passive bearing",
  유장: "Liu Zhang — soft indecisive lord of Shu lands, fine silk robes, anxious mild face",
  마등: "Ma Teng — western warlord of Qiang blood, rough fur and iron armor, long spear, weathered honest face",
  한수: "Han Sui — cunning veteran warlord of the west, sand-worn armor, gray beard, shrewd eyes",
  화웅: "Hua Xiong — towering vanguard champion of Dong Zhuo, black and red armor, great blade, arrogant challenge",
  안량: "Yan Liang — Yuan Shao's champion general, imposing gold-trimmed armor, heavy blade, bull-like force",
  문추: "Wen Chou — fierce rival champion, dark iron armor with red plume, long spear, storming charge",
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
        model: "gpt-image-2", // 최신 세대 + low = 장당 ~1센트인데 품질은 충분
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
    if (String(e.message).includes("429")) {
      await new Promise((r) => setTimeout(r, 20000));
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
}
console.log(`완료: 생성 ${ok} / 스킵 ${skip} / 실패 ${fail}`);
