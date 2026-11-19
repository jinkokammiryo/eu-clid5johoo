import { getOne, saveOne } from "../db.js";
import { pickImage, saveImage, getImageData } from "../image.js";

const CONFIG_PATH = "config/couple";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseDate(str) {
  const p = str.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function addMonths(date, n) {
  const y = date.getFullYear();
  const m = date.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(date.getDate(), last));
}

function nextAnniversary(start, t) {
  for (let n = 1; n < 2400; n++) {
    const d = addMonths(start, n);
    if (d >= t) {
      const label = n % 12 === 0 ? (n / 12) + "周年" : n + "ヶ月記念";
      return { date: d, label: label };
    }
  }
  return null;
}

function fmt(d) {
  return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

// この端末が「A」か「B」か（スマホに覚えさせる）
export function getWho() {
  try {
    return localStorage.getItem("whoami") || "";
  } catch (e) {
    return "";
  }
}

function setWho(v) {
  try {
    localStorage.setItem("whoami", v);
  } catch (e) {}
}

export async function renderTop() {
  const box = document.getElementById("top-content");
  box.innerHTML = '<p class="coming">読み込み中…</p>';
  let conf = null;
  try {
    conf = await getOne(CONFIG_PATH);
  } catch (e) {
    box.innerHTML = '<p class="coming">データを読めませんでした。ガビーン🤖。電波とログインを確認してぬぇ。</p>';
    return;
  }
  draw(box, conf || {});
}

function draw(box, conf) {
  const nameA = conf.nameA || "A";
  const nameB = conf.nameB || "B";
  const t = today();
  let counterHtml = "";
  let nextHtml = "";

  if (conf.startDate) {
    const start = parseDate(conf.startDate);
    const days = daysBetween(start, t) + 1;
    counterHtml =
      '<div class="card counter">' +
      '<div class="counter-label">付き合って</div>' +
      '<div class="counter-num">' + days + "<small>日目</small></div>" +
      '<div class="counter-sub">' + fmt(start) + "から</div>" +
      "</div>";

    const next = nextAnniversary(start, t);
    if (next) {
      const left = daysBetween(t, next.date);
      const numText = left === 0 ? "🌸本日🌸" : "あと " + left + "日";
      nextHtml =
        '<div class="card next-card">' +
        '<div class="next-icon">🎂</div>' +
        '<div class="next-body">' +
        '<div class="next-label">次の記念日（' + esc(next.label) + "）まで</div>" +
        '<div class="next-num">' + numText + "</div>" +
        "</div></div>";
    }
  } else {
    counterHtml =
      '<div class="card counter"><div class="counter-label">下の「設定」で付き合った日を入れてクレメンス💕</div></div>';
  }

  const who = getWho();

  box.innerHTML =
    '<div class="hero-photo" id="hero-photo"><div>📷<br>写真を出せ</div></div>' +
    '<p class="hero-names">' + esc(nameA) + " 💗 " + esc(nameB) + "</p>" +
    counterHtml +
    nextHtml +
    '<div class="top-actions">' +
    '<button class="btn-sub" id="top-photo-btn">📷 写真を変える</button>' +
    '<button class="btn-sub" id="top-settings-btn">⚙️ 設定</button>' +
    "</div>" +
    '<div class="card hidden" id="top-settings" style="margin-top:16px;">' +
    '<p style="margin:0 0 4px;font-size:13px;">名前A</p>' +
    '<input type="text" id="set-nameA" value="' + esc(conf.nameA || "") + '" placeholder="例：ひな">' +
    '<p style="margin:0 0 4px;font-size:13px;">名前B</p>' +
    '<input type="text" id="set-nameB" value="' + esc(conf.nameB || "") + '" placeholder="例：そら">' +
    '<p style="margin:0 0 4px;font-size:13px;">付き合った日</p>' +
    '<input type="date" id="set-start" value="' + esc(conf.startDate || "") + '">' +
    '<p style="margin:0 0 4px;font-size:13px;">このスマホは誰の？</p>' +
    '<select id="set-who">' +
    '<option value=""' + (who === "" ? " selected" : "") + ">選んでね</option>" +
    '<option value="A"' + (who === "A" ? " selected" : "") + ">A（" + esc(nameA) + "）</option>" +
    '<option value="B"' + (who === "B" ? " selected" : "") + ">B（" + esc(nameB) + "）</option>" +
    "</select>" +
    '<button class="btn" id="set-save">保存する</button>' +
    '<p class="error" id="set-msg"></p>' +
    "</div>";

  if (conf.topPhotoId) {
    getImageData(conf.topPhotoId).then(function (data) {
      if (!data) return;
      const hero = document.getElementById("hero-photo");
      if (hero) hero.innerHTML = '<img src="' + data + '" alt="ふたりの写真">';
    }).catch(function () {});
  }

  document.getElementById("top-settings-btn").addEventListener("click", function () {
    document.getElementById("top-settings").classList.toggle("hidden");
  });

  document.getElementById("top-photo-btn").addEventListener("click", async function () {
    const btn = this;
    const file = await pickImage();
    if (!file) return;
    btn.textContent = "保存中…";
    try {
      const id = await saveImage(file);
      await saveOne(CONFIG_PATH, { topPhotoId: id });
      conf.topPhotoId = id;
      draw(box, conf);
    } catch (e) {
      btn.textContent = "📷 写真を変える";
      alert("写真を保存できません。ガビーン🤖");
    }
  });

  document.getElementById("set-save").addEventListener("click", async function () {
    const msg = document.getElementById("set-msg");
    const data = {
      nameA: document.getElementById("set-nameA").value.trim(),
      nameB: document.getElementById("set-nameB").value.trim(),
      startDate: document.getElementById("set-start").value
    };
    setWho(document.getElementById("set-who").value);
    msg.textContent = "保存中…";
    try {
      await saveOne(CONFIG_PATH, data);
      Object.assign(conf, data);
      draw(box, conf);
    } catch (e) {
      msg.textContent = "保存できませんでした。もう一度頑張って。";
    }
  });
}
