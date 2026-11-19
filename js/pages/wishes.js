import { getOne, addItem, updateItem, removeItem, watchAll } from "../db.js";
import { pickImage, saveImage, getImageData } from "../image.js";
import { getWho } from "./top.js";

const CATS = ["✈️ 旅行", "🍽️ ごはん", "🚶 おでかけ", "🎪 体験・イベント", "🏠 おうち", "🛍️ 買いもの", "✨ その他"];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let unsub = null;
let items = [];
let names = { A: "A", B: "B" };
let status = "todo";
let catFilter = "";
let formOpen = false;
let editingId = null;

export async function renderWishes() {
  const root = document.getElementById("page-wishes");
  root.innerHTML = `
    <div class="page-title">📝 やりたいことリスト</div>
    <div class="card" id="w-progress"></div>
    <button class="btn" id="w-add">＋ やりたいことを追加</button>
    <div id="w-form"></div>
    <div class="w-tabs">
      <button data-st="todo">これから</button>
      <button data-st="done">達成ずみ</button>
      <button data-st="all">ぜんぶ</button>
    </div>
    <select id="w-cat">
      <option value="">カテゴリ：ぜんぶ</option>
      ${CATS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
    </select>
    <div id="w-list"></div>
  `;

  try {
    const c = await getOne("config/couple");
    names = { A: c?.nameA || "A", B: c?.nameB || "B" };
  } catch (e) {}

  root.querySelector("#w-add").onclick = () => {
    editingId = null;
    formOpen = !formOpen;
    drawForm();
  };
  root.querySelectorAll(".w-tabs button").forEach((b) => {
    b.onclick = () => {
      status = b.dataset.st;
      drawList();
    };
  });
  const sel = root.querySelector("#w-cat");
  sel.value = catFilter;
  sel.onchange = () => {
    catFilter = sel.value;
    drawList();
  };
  root.querySelector("#w-list").onclick = onListClick;

  drawForm();
  if (unsub) unsub();
  unsub = watchAll("wishes", (list) => {
    items = list;
    drawList();
  });
}

function drawForm() {
  const box = document.getElementById("w-form");
  if (!formOpen) {
    box.innerHTML = "";
    return;
  }
  const it = items.find((x) => x.id === editingId) || {};
  box.innerHTML = `
    <div class="card">
      <input id="wf-title" placeholder="やりたいこと" maxlength="60" value="${esc(it.title || "")}">
      <select id="wf-cat">
        ${CATS.map((c) => `<option value="${esc(c)}" ${it.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>
      <label class="w-label">期限（なくてもいい）</label>
      <input id="wf-deadline" type="date" value="${esc(it.deadline || "")}">
      <button class="btn" id="wf-save">${editingId ? "保存する" : "追加する"}</button>
      <button class="btn-sub" id="wf-cancel">やめる</button>
      <div class="error" id="wf-error"></div>
    </div>
  `;
  box.querySelector("#wf-cancel").onclick = () => {
    formOpen = false;
    editingId = null;
    drawForm();
  };
  box.querySelector("#wf-save").onclick = async () => {
    const title = box.querySelector("#wf-title").value.trim();
    if (!title) {
      box.querySelector("#wf-error").textContent = "やりたいことを入力してね";
      return;
    }
    const data = {
      title,
      category: box.querySelector("#wf-cat").value,
      deadline: box.querySelector("#wf-deadline").value,
    };
    try {
      if (editingId) {
        await updateItem("wishes", editingId, data);
      } else {
        await addItem("wishes", { ...data, done: false, doneAt: "", imageId: "", by: getWho() });
      }
      formOpen = false;
      editingId = null;
      drawForm();
    } catch (e) {
      box.querySelector("#wf-error").textContent = "保存できませんでした。もう一度試してください";
    }
  };
}

function drawList() {
  const total = items.length;
  const doneCount = items.filter((x) => x.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  document.getElementById("w-progress").innerHTML = `
    <div>達成 <b>${doneCount}</b> / ${total}　（${pct}%）</div>
    <div class="w-bar"><div style="width:${pct}%"></div></div>
  `;
  document.querySelectorAll(".w-tabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.st === status);
  });

  let list = items.filter((x) => {
    if (status === "todo" && x.done) return false;
    if (status === "done" && !x.done) return false;
    if (catFilter && x.category !== catFilter) return false;
    return true;
  });

  const created = (x) => x.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  list.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt || "").localeCompare(a.doneAt || "");
    const da = a.deadline || "9999-99-99";
    const db = b.deadline || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return created(a) - created(b);
  });

  const box = document.getElementById("w-list");
  if (!list.length) {
    box.innerHTML = `<div class="coming">まだ何もNOTHING</div>`;
    return;
  }
  box.innerHTML = list
    .map((x) => {
      const overdue = !x.done && x.deadline && x.deadline < today();
      const who = x.by ? names[x.by] : "";
      return `
      <div class="card w-item ${x.done ? "is-done" : ""}" data-id="${esc(x.id)}">
        <div class="w-row">
          <button class="w-check" data-act="toggle">${x.done ? "✅" : "⬜"}</button>
          <div class="w-main">
            <div class="w-title">${esc(x.title)}</div>
            <div class="w-meta">
              ${x.category ? `<span class="w-badge">${esc(x.category)}</span>` : ""}
              ${x.deadline ? `<span class="w-badge ${overdue ? "w-overdue" : ""}">${overdue ? "⚠️ " : "📅 "}${esc(x.deadline)}</span>` : ""}
              ${x.done && x.doneAt ? `<span class="w-badge">🎉 ${esc(x.doneAt)}に達成</span>` : ""}
              ${who ? `<span class="w-badge">by ${esc(who)}</span>` : ""}
            </div>
          </div>
        </div>
        ${x.imageId ? `<img class="w-thumb" data-img="${esc(x.imageId)}" data-act="zoom" alt="">` : ""}
        <div class="w-actions">
          <button class="btn-sub" data-act="photo">📷 ${x.imageId ? "写真を変える" : "証拠写真"}</button>
          <button class="btn-sub" data-act="edit">✏️ 編集</button>
          <button class="btn-sub" data-act="del">🗑 削除</button>
        </div>
      </div>`;
    })
    .join("");

  box.querySelectorAll("img[data-img]").forEach(async (img) => {
    try {
      img.src = await getImageData(img.dataset.img);
    } catch (e) {}
  });
}

async function onListClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const card = btn.closest("[data-id]");
  const id = card.dataset.id;
  const it = items.find((x) => x.id === id);
  if (!it) return;
  const act = btn.dataset.act;

  try {
    if (act === "toggle") {
      const done = !it.done;
      await updateItem("wishes", id, { done, doneAt: done ? today() : "" });
    } else if (act === "edit") {
      editingId = id;
      formOpen = true;
      drawForm();
      document.getElementById("w-form").scrollIntoView({ behavior: "smooth" });
    } else if (act === "del") {
      if (confirm("「" + it.title + "」を消すかい？")) {
        await removeItem("wishes", id);
      }
    } else if (act === "photo") {
      const file = await pickImage();
      if (!file) return;
      btn.textContent = "保存中…";
      const imageId = await saveImage(file);
      await updateItem("wishes", id, { imageId });
    } else if (act === "zoom") {
      const ov = document.createElement("div");
      ov.className = "w-overlay";
      ov.innerHTML = `<img src="${btn.src}" alt="">`;
      ov.onclick = () => ov.remove();
      document.body.appendChild(ov);
    }
  } catch (err) {
    alert("うまくいきませんでした。ガビーン🤖");
  }
}
