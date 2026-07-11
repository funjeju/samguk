import { getApps, initializeApp } from "firebase/app";
import {
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = !!config.apiKey;

const app = firebaseEnabled ? (getApps()[0] ?? initializeApp(config)) : null;
export const db = app ? getFirestore(app) : null;

let userPromise: Promise<User> | null = null;

// 익명 로그인 (최초 1회, 이후 재사용)
export function ensureUser(): Promise<User> {
  if (!app) return Promise.reject(new Error("firebase disabled"));
  if (!userPromise) {
    const auth = getAuth(app);
    userPromise = auth.currentUser
      ? Promise.resolve(auth.currentUser)
      : new Promise((resolve, reject) => {
          const unsub = auth.onAuthStateChanged((u) => {
            if (u) {
              unsub();
              resolve(u);
            }
          });
          signInAnonymously(auth).catch((e) => {
            unsub();
            userPromise = null;
            reject(e);
          });
        });
  }
  return userPromise;
}

// 회원가입: 익명 계정에 이메일을 연결 → 기존 컬렉션·전적 그대로 유지
export async function signUpEmail(email: string, password: string): Promise<User> {
  const user = await ensureUser();
  const cred = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(user, cred);
  return result.user;
}

// 로그인: 기존 이메일 계정으로 전환 (다른 기기에서 이어하기)
export async function signInEmail(email: string, password: string): Promise<User> {
  const auth = getAuth(app!);
  const result = await signInWithEmailAndPassword(auth, email, password);
  userPromise = Promise.resolve(result.user);
  return result.user;
}

// Google 로그인: 게스트(익명) 상태면 계정을 연결해 컬렉션·전적 유지,
// 이미 다른 계정에 연결된 구글 계정이면 그 계정으로 로그인 전환
export async function signInGoogle(): Promise<User> {
  const auth = getAuth(app!);
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  if (current && current.isAnonymous) {
    try {
      const result = await linkWithPopup(current, provider);
      userPromise = Promise.resolve(result.user);
      return result.user;
    } catch (e) {
      if ((e as { code?: string }).code === "auth/credential-already-in-use") {
        const result = await signInWithPopup(auth, provider);
        userPromise = Promise.resolve(result.user);
        return result.user;
      }
      throw e;
    }
  }
  const result = await signInWithPopup(auth, provider);
  userPromise = Promise.resolve(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getAuth(app!);
  await signOut(auth);
  userPromise = null; // 다음 접속 시 새 익명 계정
}

export function currentUser(): User | null {
  return app ? getAuth(app).currentUser : null;
}

export const AUTH_ERROR_KO: Record<string, string> = {
  "auth/operation-not-allowed": "Google 로그인이 아직 콘솔에서 활성화되지 않았습니다.",
  "auth/popup-closed-by-user": "로그인 창이 닫혔습니다. 다시 시도해 주세요.",
  "auth/popup-blocked": "팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.",
  "auth/email-already-in-use": "이미 가입된 이메일입니다. 로그인해 주세요.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth/invalid-credential": "이메일 또는 비밀번호가 틀렸습니다.",
  "auth/wrong-password": "비밀번호가 틀렸습니다.",
  "auth/user-not-found": "가입되지 않은 이메일입니다.",
  "auth/credential-already-in-use": "이미 다른 계정에 연결된 이메일입니다. 로그인해 주세요.",
};
