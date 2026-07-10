import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
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
