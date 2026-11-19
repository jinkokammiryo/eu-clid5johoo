import { renderWishes } from "./pages/wishes.js";
import { login, logout, watchAuth, loginErrorMessage } from "./auth.js";
import { renderTop } from "./pages/top.js";
import { renderReviews } from "./pages/reviews.js";
import { renderBoard } from "./pages/board.js";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app");
const passwordInput = document.getElementById("login-password");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout-button");
const navButtons = document.querySelectorAll(".nav-btn");

// ---------- ログイン ----------
async function doLogin() {
  const pw = passwordInput.value;
  if (!pw) {
    loginError.textContent = "パスワードを入力してね";
    return;
  }
  loginError.textContent = "";
  loginButton.textContent = "Thinking Time…";
  try {
    await login(pw);
    passwordInput.value = "";
  } catch (err) {
    loginError.textContent = loginErrorMessage(err);
  }
  loginButton.textContent = "入る";
}

loginButton.addEventListener("click", doLogin);
passwordInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") doLogin();
});

logoutButton.addEventListener("click", function () {
  logout();
});

// ---------- ページ切り替え ----------
const renderers = {
  top: renderTop,
  wishes: renderWishes,
  reviews: renderReviews,
  board: renderBoard
};

function showPage(name) {
  document.querySelectorAll(".page").forEach(function (el) {
    el.classList.add("hidden");
  });
  const target = document.getElementById("page-" + name);
  if (target) target.classList.remove("hidden");

  navButtons.forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.page === name);
  });

  if (renderers[name]) renderers[name]();
  window.scrollTo(0, 0);
}

navButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    showPage(btn.dataset.page);
  });
});

// ---------- ログイン状態の監視 ----------
watchAuth(function (user) {
  if (user) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    showPage("top");
  } else {
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
});
