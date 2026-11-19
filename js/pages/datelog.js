import { watchAll, saveOne, removeItem } from "../db.js";
import { pickImage, saveImage, getImageData } from "../image.js";

const COLORS = [
  { c: "#ff8fb8", n: "ピンク" },
  { c: "#ffb86b", n: "オレンジ" },
  { c: "#ffe066", n: "きいろ" },
  { c: "#8fd9a8", n: "みどり" },
  { c: "#7cc7f2", n: "みずいろ" },
  { c: "#c3a6f0", n: "むらさき" }
];

// [コード, 名前, 行, 列]
const PREFS = [
  ["p01", "北海道", 0, 10], ["p02", "青森", 1, 10], ["p03", "岩手", 2, 10],
  ["p04", "宮城", 3, 10], ["p05", "秋田", 2, 9], ["p06", "山形", 3, 9],
  ["p07", "福島", 4, 9], ["p08", "茨城", 6, 10], ["p09", "栃木", 5, 10],
  ["p10", "群馬", 5, 9], ["p11", "埼玉", 6, 9], ["p12", "千葉", 7, 10],
  ["p13", "東京", 7, 9], ["p14", "神奈川", 8, 9], ["p15", "新潟", 4, 8],
  ["p16", "富山", 5, 7], ["p17", "石川", 5, 6], ["p18", "福井", 6, 5],
  ["p19", "山梨", 6, 8], ["p20", "長野", 5, 8], ["p21", "岐阜", 6, 6],
  ["p22", "静岡", 7, 8], ["p23", "愛知", 7, 7], ["p24", "三重", 7, 6],
  ["p25", "滋賀", 7, 5], ["p26", "京都", 7, 4], ["p27", "大阪", 8, 3],
  ["p28", "兵庫", 7, 3], ["p29", "奈良", 8, 4], ["p30", "和歌山", 8, 5],
  ["p31", "鳥取", 7, 2], ["p32", "島根", 7, 1], ["p33", "岡山", 8, 2],
  ["p34", "広島", 8, 1], ["p35", "山口", 8, 0], ["p36", "徳島", 9, 4],
  ["p37", "香川", 9, 3], ["p38", "愛媛", 10, 2], ["p39", "高知", 10, 3],
  ["p40", "福岡", 9, 0], ["p41", "佐賀", 10, 0], ["p42", "長崎", 11, 0],
  ["p43", "熊本", 10, 1], ["p44", "大分", 9, 1], ["p45", "宮崎", 11, 1],
  ["p46", "鹿児島", 12, 1], ["p47", "沖縄", 13, 0]
];

// [コード, 絵文字, 名前]
const WORLD = [
  ["w-kr", "🇰🇷", "韓国"], ["w-tw", "🇹🇼", "台湾"], ["w-cn", "🇨🇳", "中国"],
  ["w-hk", "🇭🇰", "香港"], ["w-th", "🇹🇭", "タイ"], ["w-vn", "🇻🇳", "ベトナム"],
  ["w-sg", "🇸🇬", "シンガポール"], ["w-my", "🇲🇾", "マレーシア"],
  ["w-id", "🇮🇩", "インドネシア"], ["w-ph", "🇵🇭", "フィリピン"],
  ["w-in", "🇮🇳", "インド"], ["w-us", "🇺🇸", "アメリカ"],
  ["w-hi", "🌺", "ハワイ"], ["w-gu", "🏝️", "グアム"], ["w-ca", "🇨🇦", "カナダ"],
  ["w-gb", "🇬🇧", "イギリス"], ["w-fr", "🇫🇷", "フランス"],
  ["w-de", "🇩🇪", "ドイツ"], ["w-it", "🇮🇹", "イタリア"],
  ["w-es", "🇪🇸", "スペイン"], ["w-nl", "🇳🇱", "オランダ"],
  ["w-ch", "🇨🇭", "スイス"], ["w-tr", "🇹🇷", "トルコ"],
  ["w-eg", "🇪🇬", "エジプト"], ["w-au", "🇦🇺", "オーストラリア"],
  ["w-nz", "🇳🇿", "ニュージーランド"]
];

const MAX_PHOTOS = 12;

let unsub = null;
let places = {};
let current = null;
let draft = null;
let origMemo = "";
let skipSave = false;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function safeColor(p) {
  const c = p && p.color;
  return COLORS.some((x) => x.c === c) ? c : "";
}

function hasNote(p) {
  if (!p) return false;
  return !!((p.memo && String(p.memo).trim()) || (Array.isArray(p.imageIds) && p.imageIds.length));
}

function fullName(s) {
  if (s === "北海道") return s;
  if (s === "東京") return "東京都";
  if (s === "大阪" || s === "京都") return s + "府";
  return s + "県";
}

function infoOf(id) {
  const pref = PREFS.find((p) => p[0] === id);
  if (pref) return { name: fullName(pref[1]), custom: false };
  const w = WORLD.find((x) => x[0] === id);
  if (w) return { name: `${w[1]} ${w[2]}`, custom: false };
  const p = places[id] || {};
  return { name: `${p.flag || "🌏"} ${p.name || "ほかの国"}`, custom: true };
}

function closeLayer() {
  const l = document.getElementById("dl-layer");
  if (l) l.remove();
}

export function renderDatelog() {
  const root = document.getElementById("page-datelog");
  if (!root) return;

  if (unsub) { unsub(); unsub = null; }
  closeLayer();
  places = {};
  current = null;
  draft = null;

  root.innerHTML = `
    <h2 class="page-title">🗺️ 旅行・デートログ</h2>
    <div class="card">
      <div class="dl-count" id="dl-count-jp"></div>
      <div class="dl-bar"><div class="dl-bar-in" id="dl-bar"></div></div>
      <div class="dl-count dl-count-world" id="dl-count-world"></div>
    </div>
    <div class="card dl-mapcard">
      <h3 class="dl-sub">🗾 日本</h3>
      <div class="dl-map" id="dl-map"></div>
      <p class="dl-hint">タップすると、色・メモ・写真を入れられます</p>
    </div>
    <div class="card">
      <h3 class="dl-sub">🌏 海外</h3>
      <div class="dl-world" id="dl-world"></div>
      <h3 class="dl-sub dl-sub2">ほかの国を追加</h3>
      <div class="dl-addrow">
        <input class="dl-input" id="dl-new-name" type="text" maxlength="20" placeholder="例：アイスランド">
        <button class="btn dl-addbtn" id="dl-add" type="button">追加</button>
      </div>
    </div>
  `;

  document.getElementById("dl-map").addEventListener("click", onTileClick);
  document.getElementById("dl-world").addEventListener("click", onTileClick);
  document.getElementById("dl-add").addEventListener("click", addCountry);
  renderTiles();

  unsub = watchAll("places", (list) => {
    const m = {};
    (Array.isArray(list) ? list : []).forEach((p) => { m[p.id] = p; });
    places = m;
    renderTiles();
  });
}

function renderTiles() {
  const map = document.getElementById("dl-map");
  const world = document.getElementById("dl-world");
  if (!map || !world) return;

  let jpCount = 0;
  map.innerHTML = PREFS.map(([id, name, r, c]) => {
    const p = places[id] || {};
    const color = safeColor(p);
    if (color) jpCount++;
    const cls = "dl-tile" + (name.length >= 3 ? " dl-t3" : "") + (hasNote(p) ? " dl-has" : "");
    const bg = color ? `background:${color};color:#5a2a40;border-color:${color};` : "";
    return `<button class="${cls}" data-id="${id}" style="grid-row:${r + 1};grid-column:${c + 1};${bg}" type="button">${esc(name)}</button>`;
  }).join("");

  const customs = Object.keys(places)
    .filter((id) => id.startsWith("w-c"))
    .sort()
    .map((id) => ({
      id,
      flag: places[id].flag || "🌏",
      name: places[id].name || "ほかの国"
    }));
  const all = WORLD.map(([id, flag, name]) => ({ id, flag, name })).concat(customs);

  let wCount = 0;
  world.innerHTML = all.map((w) => {
    const p = places[w.id] || {};
    const color = safeColor(p);
    if (color) wCount++;
    const cls = "dl-wtile" + (hasNote(p) ? " dl-has" : "");
    const bg = color ? `background:${color};color:#5a2a40;border-color:${color};` : "";
    return `<button class="${cls}" data-id="${esc(w.id)}" style="${bg}" type="button">
      <span class="dl-flag">${esc(w.flag)}</span>
      <span class="dl-wname">${esc(w.name)}</span>
    </button>`;
  }).join("");

  document.getElementById("dl-count-jp").textContent = `🗾 日本：${jpCount} / 47 都道府県`;
  document.getElementById("dl-bar").style.width = `${Math.round((jpCount / 47) * 100)}%`;
  document.getElementById("dl-count-world").textContent = `🌏 海外：${wCount} か国`;
}

function onTileClick(e) {
  const b = e.target.closest("button[data-id]");
  if (b) openSheet(b.dataset.id);
}

async function addCountry() {
  const input = document.getElementById("dl-new-name");
  const name = input.value.trim();
  if (!name) return;
  const btn = document.getElementById("dl-add");
  btn.disabled = true;
  const id = "w-c" + Date.now();
  const data = {
    name, flag: "🌏", kind: "world",
    color: COLORS[0].c, memo: "", imageIds: []
  };
  try {
    await saveOne("places/" + id, data);
    places[id] = { id, ...data };
    input.value = "";
    renderTiles();
  } catch (e) {
    alert("追加に失敗しました。ガチャーン🤖。");
  }
  btn.disabled = false;
}

// ---------- 詳細シート ----------
function openSheet(id) {
  closeLayer();
  const p = places[id] || {};
  current = id;
  draft = {
    color: safeColor(p),
    memo: p.memo || "",
    imageIds: Array.isArray(p.imageIds) ? p.imageIds.slice() : []
  };
  origMemo = draft.memo;
  skipSave = false;
  const info = infoOf(id);

  const layer = document.createElement("div");
  layer.id = "dl-layer";
  layer.innerHTML = `
    <div class="dl-bg" id="dl-bg">
      <div class="dl-sheet">
        <h3 class="dl-sheet-title">${esc(info.name)}</h3>
        <div class="dl-label">色をえらぶ（色がついたら「行った」）</div>
        <div class="dl-colors" id="dl-colors"></div>
        <div class="dl-label">メモ</div>
        <textarea class="dl-memo" id="dl-memo" rows="4" maxlength="1000" placeholder="思い出をメモしよう">${esc(draft.memo)}</textarea>
        <div class="dl-label">写真（<span id="dl-pcount">0</span> / ${MAX_PHOTOS}）</div>
        <div class="dl-photos" id="dl-photos"></div>
        <button class="btn-sub dl-addphoto" id="dl-addphoto" type="button">📷 写真を追加</button>
        <p class="error" id="dl-error"></p>
        <button class="btn dl-close" id="dl-close" type="button">保存してとじる</button>
        ${info.custom ? `<button class="btn-sub dl-delplace" id="dl-delplace" type="button">この場所を削除</button>` : ""}
      </div>
    </div>
    <div id="dl-zoom"></div>
  `;
  document.body.appendChild(layer);

  layer.addEventListener("click", onLayerClick);
  document.getElementById("dl-close").addEventListener("click", finish);
  document.getElementById("dl-addphoto").addEventListener("click", addPhoto);
  const del = document.getElementById("dl-delplace");
  if (del) del.addEventListener("click", deletePlace);

  renderColors();
  renderPhotos();
}

function onLayerClick(e) {
  if (e.target.id === "dl-bg") { finish(); return; }

  const chip = e.target.closest("button[data-color]");
  if (chip) { setColor(chip.dataset.color); return; }

  const del = e.target.closest("button[data-del]");
  if (del) { deletePhoto(del.dataset.del); return; }

  const img = e.target.closest(".dl-ph img");
  if (img && img.src) {
    const z = document.getElementById("dl-zoom");
    z.innerHTML = `<div class="dl-zoom"><img alt=""></div>`;
    z.querySelector("img").src = img.src;
    z.querySelector(".dl-zoom").addEventListener("click", () => { z.innerHTML = ""; });
  }
}

function renderColors() {
  const box = document.getElementById("dl-colors");
  if (!box) return;
  box.innerHTML = COLORS.map((x) => {
    const on = draft.color === x.c;
    return `<button class="dl-chip${on ? " on" : ""}" data-color="${x.c}" style="background:${x.c}" aria-label="${x.n}" type="button">${on ? "✓" : ""}</button>`;
  }).join("") +
    `<button class="dl-chip dl-chip-none${!draft.color ? " on" : ""}" data-color="" type="button">未訪問</button>`;
}

function setColor(c) {
  if (!current) return;
  draft.color = c;
  renderColors();
  places[current] = { ...(places[current] || {}), id: current, color: c };
  renderTiles();
  saveOne("places/" + current, { color: c }).catch(() => {
    showError("色の保存に失敗しました。ガシャーン🤖");
  });
}

function renderPhotos() {
  const box = document.getElementById("dl-photos");
  if (!box) return;
  document.getElementById("dl-pcount").textContent = draft.imageIds.length;

  if (!draft.imageIds.length) {
    box.innerHTML = `<p class="dl-empty">まだ写真がありません</p>`;
    return;
  }
  box.innerHTML = draft.imageIds.map((id) => `
    <div class="dl-ph">
      <img data-img="${esc(id)}" alt="思い出の写真">
      <button class="dl-ph-del" data-del="${esc(id)}" type="button" aria-label="写真を削除">×</button>
    </div>`).join("");

  box.querySelectorAll("img[data-img]").forEach((img) => {
    getImageData(img.dataset.img).then((src) => {
      if (img.isConnected && src) img.src = src;
    }).catch(() => {});
  });
}

function showError(msg) {
  const el = document.getElementById("dl-error");
  if (el) el.textContent = msg;
}

async function addPhoto() {
  showError("");
  if (!current) return;
  if (draft.imageIds.length >= MAX_PHOTOS) {
    showError(`写真は1か所${MAX_PHOTOS}枚までです。`);
    return;
  }
  const id = current;
  const d = draft;
  const btn = document.getElementById("dl-addphoto");
  try {
    const f = await pickImage();
    if (!f) return;
    btn.disabled = true;
    btn.textContent = "保存中…";
    const imgId = await saveImage(f);
    d.imageIds.push(imgId);
    await saveOne("places/" + id, { imageIds: d.imageIds });
    places[id] = { ...(places[id] || {}), id, imageIds: d.imageIds.slice() };
    if (current === id) renderPhotos();
    renderTiles();
  } catch (e) {
    showError("写真を保存できませんでした。もう一度お試しください。");
  }
  const b2 = document.getElementById("dl-addphoto");
  if (b2) { b2.disabled = false; b2.textContent = "📷 写真を追加"; }
}

async function deletePhoto(imgId) {
  if (!current) return;
  if (!confirm("この写真を削除しますか？")) return;
  const id = current;
  draft.imageIds = draft.imageIds.filter((x) => x !== imgId);
  renderPhotos();
  try {
    await saveOne("places/" + id, { imageIds: draft.imageIds });
    places[id] = { ...(places[id] || {}), id, imageIds: draft.imageIds.slice() };
    renderTiles();
    removeItem("images", imgId).catch(() => {});
  } catch (e) {
    showError("写真の削除に失敗しました。ガシャーン🤖");
  }
}

async function deletePlace() {
  if (!current) return;
  if (!confirm("この場所を削除しますか？写真もろとも爆発します。")) return;
  const id = current;
  const ids = draft.imageIds.slice();
  skipSave = true;
  try {
    await removeItem("places", id);
    ids.forEach((x) => removeItem("images", x).catch(() => {}));
  } catch (e) {
    skipSave = false;
    showError("削除に失敗しました。あらーん🤖。");
    return;
  }
  delete places[id];
  finish();
}

function finish() {
  const id = current;
  if (id && !skipSave) {
    const ta = document.getElementById("dl-memo");
    const memo = ta ? ta.value.trim() : origMemo;
    if (memo !== origMemo) {
      places[id] = { ...(places[id] || {}), id, memo };
      saveOne("places/" + id, { memo }).catch(() => {
        alert("メモの保存に失敗しました。カッシャコーン🤖。");
      });
    }
  }
  current = null;
  draft = null;
  closeLayer();
  renderTiles();
}
