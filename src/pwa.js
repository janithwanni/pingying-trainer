/* Service worker registration + "add to home screen" hint. */
const DISMISS_KEY = "pinyin-sprint:install-dismissed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function dismissed() {
  try {
    return !!localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
}

function showBanner(html, onAction) {
  const bar = document.getElementById("installBar");
  bar.innerHTML = `<span>${html}</span>
    ${onAction ? `<button class="btn primary" data-act>Install</button>` : ""}
    <button class="icon-btn" data-close aria-label="Dismiss">✕</button>`;
  bar.hidden = false;
  bar.querySelector("[data-act]")?.addEventListener("click", onAction);
  bar.querySelector("[data-close]").addEventListener("click", () => {
    bar.hidden = true;
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  });
}

export function initPwa() {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
  if (isStandalone() || dismissed()) return;

  // Android / desktop Chrome & Edge: native install prompt.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    showBanner("Install Mandarin Sprint on your home screen for one-tap, offline practice.", async () => {
      e.prompt();
      await e.userChoice.catch(() => {});
      document.getElementById("installBar").hidden = true;
    });
  });

  // iOS Safari has no prompt — explain the Share menu instead.
  if (isIos()) {
    setTimeout(
      () => showBanner("Add to your home screen: tap <b>Share</b> <span aria-hidden='true'>⎋</span> then <b>Add to Home Screen</b>."),
      1500
    );
  }
}
