// Firebase 프로젝트 초기 설정 자동화 (서비스 계정 사용)
// 1) 필요한 API 활성화  2) Firestore DB 생성  3) 익명 로그인 활성화  4) 보안 규칙 배포
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(readFileSync(join(root, "firebase-admin-key.json"), "utf8"));
const PROJECT = sa.project_id;

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const sig = signer.sign(sa.private_key, "base64url");
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claims}.${sig}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("토큰 발급 실패: " + JSON.stringify(data));
  return data.access_token;
}

const token = await getToken();
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function call(label, method, url, body) {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const ok = res.ok || (data?.error?.status === "ALREADY_EXISTS");
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok && data?.error ? " (이미 존재)" : ""}`);
  if (!ok) console.log("   ", JSON.stringify(data).slice(0, 300));
  return { ok, data };
}

// 1) API 활성화
for (const api of ["firestore.googleapis.com", "identitytoolkit.googleapis.com", "firebaserules.googleapis.com"]) {
  await call(
    `API 활성화: ${api}`,
    "POST",
    `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${api}:enable`
  );
}
await new Promise((r) => setTimeout(r, 5000)); // 전파 대기

// 2) Firestore DB 생성 (native, 서울 리전)
await call(
  "Firestore DB 생성 (asia-northeast3)",
  "POST",
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases?databaseId=(default)`,
  { type: "FIRESTORE_NATIVE", locationId: "asia-northeast3" }
);

// 3) 익명 로그인 활성화
await call(
  "익명 로그인 활성화",
  "PATCH",
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=signIn.anonymous.enabled`,
  { signIn: { anonymous: { enabled: true } } }
);

// 4) 보안 규칙 배포: 본인 데이터만 읽기/쓰기
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /cards/{cardId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid;
    }
    // PvP 방 (지인전 v1 — 로그인 사용자 접근 허용)
    match /rooms/{roomId} {
      allow read, create, update: if request.auth != null;
      match /picks/{turn} {
        allow read, create, update: if request.auth != null;
      }
    }
  }
}`;

const rs = await call("규칙셋 생성", "POST", `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`, {
  source: { files: [{ name: "firestore.rules", content: RULES }] },
});
if (rs.ok && rs.data.name) {
  const rel = await call(
    "규칙 릴리스",
    "POST",
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
    { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName: rs.data.name }
  );
  if (!rel.ok) {
    await call(
      "규칙 릴리스(업데이트)",
      "PATCH",
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`,
      { release: { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName: rs.data.name } }
    );
  }
}
console.log("\n설정 완료");
