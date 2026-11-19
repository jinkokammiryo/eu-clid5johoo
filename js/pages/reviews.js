import { getOne, addItem, updateItem, removeItem, watchAll } from "../db.js";
import { getWho } from "./top.js";

const TYPES = ["🎪 バラエティ", "🎬 映画", "📺 ドラマ", "🌸 アニメ", "🎮 ゲーム", "▶️ YouTube"];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "未評価");

let unsub = null;
let items = [];
let names = { A: "A", B: "B" };
let typeFilter = "";
let formOpen = false;
let editingId = null;
let formRating = 0;

export async function renderReviews() {
  const root = document.getElementById("page-reviews");
  root.innerHTML = `
    <div class="page-title">🎬 作品レビュー帳</div>
    <button class="btn" id="r-add">＋ 作品を追加</button>
    <div id="r-form"></div>
    <select id="r-type">
      <option value="">種類：ぜんぶ</option>
      ${TYPES.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
    </select>
    <div id="r-list"></div>
  `;

  try {
    const c = await getOne("config/couple");
    names = { A: c?.nameA || "A", B: c?.nameB || "B" };
  } catch (e) {}

  root.querySelector("#r-add").onclick = () => {
    editingId = null;
    formRating = 0;
    formOpen = !formOpen;
    drawForm();
  };
  const sel = root.querySelector("#r-type");
  sel.value = typeFilter;
  sel.onchange = () => {
    typeFilter = sel.value;
    drawList();
  };
  root.querySelector("#r-list").onclick = onListClick;

  drawForm();
  if (unsub) unsub();
  unsub = watchAll("reviews", (list) => {
    items = list;
    drawList();
  });
}

function drawForm() {
  const box = document.getElementById("r-form");
  if (!formOpen) {
    box.innerHTML = "";
    return;
  }
  const who = getWho();
  if (!who) {
    box.innerHTML = `<div class="card error">先にトップの「⚙️ 設定」で「このスマホは誰の？」を選んでください</div>`;
    return;
  }
  const it = items.find((x) => x.id === editingId) || {};
  const myComment = it["comment" + who] || "";

  box.innerHTML = `
    <div class="card">
      <input id="rf-title" placeholder="作品名" maxlength="60" value="${esc(it.title || "")}">
      <select id="rf-type">
        ${TYPES.map((t) => `<option value="${esc(t)}" ${it.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
      </select>
      <div class="r-label">${esc(names[who])}の評価</div>
      <div class="r-stars" id="rf-stars">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}">☆</button>`).join("")}
      </div>
      <textarea id="rf-comment" rows="4" maxlength="500" placeholder="感想（なくてもいい）">${esc(myComment)}</textarea>
      <button class="btn" id="rf-save">${editingId ? "保存する" : "追加する"}</button>
      <button class="btn-sub" id="rf-cancel">やめる</button>
      <div class="error" id="rf-error"></div>
    </div>
  `;

  const drawStars = () => {
    box.querySelectorAll("#rf-stars button").forEach((b) => {
      const on = Number(b.dataset.n) <= formRating;
      b.textContent = on ? "★" : "☆";
      b.classList.toggle("on", on);
    });
  };
  box.querySelector("#rf-stars").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const n = Number(b.dataset.n);
    formRating = formRating === n ? 0 : n;
    drawStars();
  };
  drawStars();

  box.querySelector("#rf-cancel").onclick = () => {
    formOpen = false;
    editingId = null;
    drawForm();
  };
  box.querySelector("#rf-save").onclick = async () => {
    const title = box.querySelector("#rf-title").value.trim();
    if (!title) {
      box.querySelector("#rf-error").textContent = "作品名を入力してください";
      return;
    }
    const data = {
      title,
      type: box.querySelector("#rf-type").value,
      ["rating" + who]: formRating,
      ["comment" + who]: box.querySelector("#rf-comment").value.trim(),
    };
    try {
      if (editingId) {
        await updateItem("reviews", editingId, data);
      } else {
        await addItem("reviews", { ratingA: 0, ratingB: 0, commentA: "", commentB: "", ...data });
      }
      formOpen = false;
      editingId = null;
      drawForm();
    } catch (e) {
      box.querySelector("#rf-error").textContent = "保存できませんでした。ガビーン🤖";
    }
  };
}

function drawList() {
  const created = (x) => x.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  const list = items
    .filter((x) => !typeFilter || x.type === typeFilter)
    .sort((a, b) => created(b) - created(a));

  const box = document.getElementById("r-list");
  if (!list.length) {
    box.innerHTML = `<div class="coming">まだ何もNOTHING</div>`;
    return;
  }
  box.innerHTML = list
    .map((x) => {
      const a = x.ratingA || 0;
      const b = x.ratingB || 0;
      const avg = a && b ? ((a + b) / 2).toFixed(1) : "";
      const side = (key) => {
        const r = x["rating" + key] || 0;
        const c = x["comment" + key] || "";
        return `
        <div class="r-side">
          <div class="r-name">${esc(names[key])}</div>
          <div class="r-score">${stars(r)}</div>
          ${c ? `<div class="r-comment">${esc(c)}</div>` : ""}
        </div>`;
      };
      return `
      <div class="card" data-id="${esc(x.id)}">
        <div class="r-head">
          <div class="r-title">${esc(x.title)}</div>
          ${avg ? `<div class="r-avg">平均 ${avg}</div>` : ""}
        </div>
        ${x.type ? `<span class="r-badge">${esc(x.type)}</span>` : ""}
        ${side("A")}
        ${side("B")}
        <div class="r-actions">
          <button class="btn-sub" data-act="edit">✏️ 編集・感想を書く</button>
          <button class="btn-sub" data-act="del">🗑 削除</button>
        </div>
      </div>`;
    })
    .join("");
}

async function onListClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest("[data-id]").dataset.id;
  const it = items.find((x) => x.id === id);
  if (!it) return;

  if (btn.dataset.act === "edit") {
    const who = getWho();
    editingId = id;
    formRating = who ? it["rating" + who] || 0 : 0;
    formOpen = true;
    drawForm();
    document.getElementById("r-form").scrollIntoView({ behavior: "smooth" });
  } else if (btn.dataset.act === "del") {
    if (confirm("「" + it.title + "」を削除しますか？")) {
      try {
        await removeItem("reviews", id);
      } catch (err) {
        alert("削除できませんでした。ガビーン🤖");
      }
    }
  }
}
