import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 1件のデータを読む（なければ null）
export async function getOne(path) {
  const snap = await getDoc(doc(db, path));
  return snap.exists() ? snap.data() : null;
}

// 1件のデータを保存（上書き・一部だけ更新もOK）
export async function saveOne(path, data) {
  await setDoc(doc(db, path), data, { merge: true });
}

// コレクションを全部読む
export async function getAll(path) {
  const snap = await getDocs(collection(db, path));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 追加（IDは自動）。作った時間も自動で入る
export async function addItem(path, data) {
  const ref = await addDoc(collection(db, path), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

// 更新・削除
export async function updateItem(path, id, data) {
  await updateDoc(doc(db, path, id), data);
}

export async function removeItem(path, id) {
  await deleteDoc(doc(db, path, id));
}

// リアルタイム監視（変わったら自動で呼ばれる）
export function watchAll(path, callback) {
  return onSnapshot(collection(db, path), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
