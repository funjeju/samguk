// 장수 초상 URL — Firebase Storage(art/)에서 다운로드 토큰으로 공개 서빙.
// public/art 로컬 번들을 제거해 배포·git 용량을 줄였다. 값은 모두 공개용(비밀 아님).
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "samguk-c8e90.firebasestorage.app";
const TOKEN = process.env.NEXT_PUBLIC_ART_TOKEN || "7b3e1c9a-4d2f-4b8e-9a1c-2f6d8e0a5c31";

export const artUrl = (id: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`art/${id}.webp`)}?alt=media&token=${TOKEN}`;
