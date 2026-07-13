// public/art/*.webp → Firebase Storage(art/) 업로드
// 다운로드 토큰(고정)을 메타데이터에 심어 보안규칙 변경 없이 공개 접근 가능하게 함.
// 실행: node scripts/upload-art.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env.local"), "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};

const BUCKET = get("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
const TOKEN = "7b3e1c9a-4d2f-4b8e-9a1c-2f6d8e0a5c31"; // 고정 공개 다운로드 토큰
const serviceAccount = JSON.parse(readFileSync(join(root, "firebase-admin-key.json"), "utf8"));

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: BUCKET,
});

const bucket = getStorage(app).bucket();
const ART = join(root, "public", "art");
const files = readdirSync(ART).filter((f) => f.endsWith(".webp"));
console.log(`${files.length}개 업로드 시작 → gs://${BUCKET}/art/`);

let ok = 0, fail = 0;
for (const f of files) {
  try {
    await bucket.upload(join(ART, f), {
      destination: `art/${f}`,
      metadata: {
        contentType: "image/webp",
        cacheControl: "public, max-age=31536000, immutable",
        metadata: { firebaseStorageDownloadTokens: TOKEN },
      },
    });
    ok++;
    if (ok % 20 === 0) console.log(`  ${ok}/${files.length}`);
  } catch (e) {
    fail++;
    console.log(`  실패 ${f}: ${e.message}`);
  }
}
console.log(`완료: 성공 ${ok} / 실패 ${fail}`);
console.log(`샘플 URL: https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent("art/" + files[0])}?alt=media&token=${TOKEN}`);
