import { watchAll, addItem, getOne } from "../db.js";
import { pickImage, saveImage, getImageData } from "../image.js";
import { getWho } from "./top.js";

let unsub = null;
let posts = [];
let names = { A: "A", B: "B" };
let pickedFile = null;
let previewUrl = "";
let showCount = 50;
let sending = false;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtTime(ts) {
  if (!ts || !ts.seconds) return "送信中…";
  const d = new Date(ts.seconds * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export async function renderBoard() {
  const root = document.getElementById("page-board");
  if (!root) return;

  if (unsub) { unsub(); unsub = null; }
  posts = [];
  pickedFile = null;
  previewUrl = "";
  showCount = 50;
  sending = false;

  const who = getWho();

  root.innerHTML = `
    <h2 class="page-title">💬 ふたりの掲示板</h2>
    <div class="card">
      ${who ? "" : `<p class="bd-warn">ホームの「⚙️ 設定」で「このスマホは誰の？」を選ぶと、投稿できるようになります。</p>`}
      <textarea class="bd-text" id="bd-text" rows="3" maxlength="500" placeholder="いまどうしてる？"></textarea>
      <div class="bd-preview hidden" id="bd-preview"></div>
      <div class="bd-actions">
        <button class="btn-sub bd-btn" id="bd-photo" type="button">📷 写真</button>
        <button class="btn bd-post" id="bd-post" type="button">投稿する</button>
      </div>
      <p class="bd-note">※ 投稿はあとから編集・削除できないよ</p>
      <p class="error" id="bd-error"></p>
    </div>
    <div id="bd-list"></div>
  `;

  document.getElementById("bd-photo").addEventListener("click", onPickPhoto);
  document.getElementById("bd-post").addEventListener("click", onPost);
  document.getElementById("bd-list").addEventListener("click", onListClick);

  try {
    const c = await getOne("config/couple");
    if (c) {
      names = { A: c.nameA || "A", B: c.nameB || "B" };
    }
  } catch (e) {}

  unsub = watchAll("posts", (list) => {
    const arr = Array.isArray(list) ? list.slice() : [];
    const t = (x) => (x.createdAt && x.createdAt.seconds) ? x.createdAt.seconds : 9e12;
    arr.sort((a, b) => t(b) - t(a));
    posts = arr;
    renderList();
  });
}

function renderList() {
  const box = document.getElementById("bd-list");
  if (!box) return;
  const who = getWho();

  if (posts.length === 0) {
    box.innerHTML = `<p class="bd-empty">まだ投稿がないよ。はやく投稿してね。</p>`;
    return;
  }

  const shown = posts.slice(0, showCount);
  let html = shown.map((p) => {
    const mine = who && p.by === who;
    const name = p.by === "A" ? names.A : p.by === "B" ? names.B : "？";
    return `
      <div class="bd-item ${mine ? "bd-me" : "bd-other"}">
        <div class="bd-meta">
          <span class="bd-name">${esc(name)}</span>
          <span class="bd-time">${esc(fmtTime(p.createdAt))}</span>
        </div>
        ${p.text ? `<div class="bd-body">${esc(p.text).replace(/\n/g, "<br>")}</div>` : ""}
        ${p.imageId ? `<img class="bd-img" data-img="${esc(p.imageId)}" alt="投稿の写真">` : ""}
      </div>`;
  }).join("");

  if (posts.length > showCount) {
    html += `<button class="btn-sub bd-more" data-act="more" type="button">もっと見る</button>`;
  }
  box.innerHTML = html;

  box.querySelectorAll("img[data-img]").forEach((img) => {
    getImageData(img.dataset.img).then((src) => {
      if (img.isConnected && src) img.src = src;
    }).catch(() => {});
  });
}

function onListClick(e) {
  const more = e.target.closest("button[data-act='more']");
  if (more) {
    showCount += 50;
    renderList();
    return;
  }
  const img = e.target.closest("img.bd-img");
  if (img && img.src) {
    const z = document.createElement("div");
    z.className = "bd-zoom";
    z.innerHTML = `<img src="${img.src}" alt="">`;
    z.addEventListener("click", () => z.remove());
    document.body.appendChild(z);
  }
}

async function onPickPhoto() {
  try {
    const f = await pickImage();
    if (!f) return;
    pickedFile = f;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(f);
    const pv = document.getElementById("bd-preview");
    pv.classList.remove("hidden");
    pv.innerHTML = `
      <img src="${previewUrl}" alt="">
      <button class="btn-sub bd-btn" id="bd-unpick" type="button">写真をやめる</button>`;
    document.getElementById("bd-unpick").addEventListener("click", clearPhoto);
  } catch (e) {
    document.getElementById("bd-error").textContent = "写真を読み込めませんでした。ガビーン🤖";
  }
}

function clearPhoto() {
  pickedFile = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  const pv = document.getElementById("bd-preview");
  if (pv) { pv.classList.add("hidden"); pv.innerHTML = ""; }
}

async function onPost() {
  if (sending) return;
  const err = document.getElementById("bd-error");
  err.textContent = "";

  const who = getWho();
  if (!who) {
    err.textContent = "ホームの「設定」で、このスマホが誰のものか選んでください。";
    return;
  }
  const ta = document.getElementById("bd-text");
  const text = ta.value.trim();
  if (!text && !pickedFile) {
    err.textContent = "なんか入れてください。";
    return;
  }

  sending = true;
  const btn = document.getElementById("bd-post");
  btn.disabled = true;
  btn.textContent = "送信中…";

  try {
    let imageId = "";
    if (pickedFile) imageId = await saveImage(pickedFile);
    await addItem("posts", { text, by: who, imageId });
    ta.value = "";
    clearPhoto();
  } catch (e) {
    err.textContent = "投稿に失敗しました。ガビーン🤖。";
  }

  sending = false;
  btn.disabled = false;
  btn.textContent = "投稿する";
}
