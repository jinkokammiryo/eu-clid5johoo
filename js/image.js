import { addItem, getOne } from "./db.js";

const MAX_SIDE = 1000;
const TARGET_BYTES = 200 * 1024;

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("エラー出てまちゅ"));
    };
    img.src = url;
  });
}

// 写真を小さくして、文字データ（dataURL）にする
export async function compressImage(file) {
  const img = await loadImageElement(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  let result = null;

  for (let round = 0; round < 4; round++) {
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);

    for (let q = 0.8; q >= 0.4; q -= 0.1) {
      const data = canvas.toDataURL("image/jpeg", q);
      result = { data, w, h };
      if (data.length * 0.75 <= TARGET_BYTES) {
        return result;
      }
    }
    scale *= 0.85;
  }
  return result;
}

// 写真を圧縮してFirestoreに保存して、IDを返す
export async function saveImage(file) {
  const img = await compressImage(file);
  return await addItem("images", img);
}

// IDから写真データを取り出す（一度読んだらスマホ内に覚えておく）
const cache = new Map();
export async function getImageData(id) {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  const doc = await getOne("images/" + id);
  const data = doc ? doc.data : null;
  cache.set(id, data);
  return data;
}

// スマホの写真選択画面を開いて、選んだファイルを返す
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}
