import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./db.js";

// ⚠️⚠️⚠️ ここを本物のメールにしてね ⚠️⚠️⚠️
// 「メルアド」の部分だけを書き換える（前後の " " は消さない）
const COUPLE_EMAIL = "365days@christmas.com";

export function login(password) {
  return signInWithEmailAndPassword(auth, COUPLE_EMAIL, password);
}

export function logout() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginErrorMessage(err) {
  const code = err && err.code ? err.code : "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "パスワード違います";
  }
  if (code === "auth/too-many-requests") {
    return "おうちのメモをみてください";
  }
  if (code === "auth/network-request-failed") {
    return "電波激悪です";
  }
  return "ログイン失敗丸";
}
