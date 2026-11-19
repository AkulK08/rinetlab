const film = document.getElementById("heroFilm");
const filmToggle = document.getElementById("filmToggle");
const copyCommand = document.getElementById("copyCommand");
const installCommand = document.getElementById("installCommand");
const downloadBaseline = 1863;
const downloadMetricsUrl = "/metrics/downloads.json";
const feedbackDialog = document.getElementById("feedbackDialog");

function displayDownloadCount(value) {
  const display = document.getElementById("downloadCount");
  display.textContent = Math.max(downloadBaseline, Number(value) || 0).toLocaleString();
  display.classList.add("is-ready");
}

document.getElementById("year").textContent = new Date().getFullYear();
const mobileHero = window.matchMedia("(max-width: 600px)");
if (mobileHero.matches) {
  film.pause();
  film.removeAttribute("autoplay");
  filmToggle.hidden = true;
} else {
  film.defaultPlaybackRate = 0.4;
  film.playbackRate = 0.4;
  film.addEventListener("loadedmetadata", () => { film.playbackRate = 0.4; }, { once: true });
}

document.querySelectorAll("[data-open-feedback]").forEach(button => button.addEventListener("click", () => {
  if (typeof feedbackDialog.showModal === "function") feedbackDialog.showModal();
  else feedbackDialog.setAttribute("open", "");
}));
document.querySelector("[data-close-feedback]")?.addEventListener("click", () => feedbackDialog.close());
feedbackDialog?.addEventListener("click", event => {
  if (event.target === feedbackDialog) feedbackDialog.close();
});

filmToggle.addEventListener("click", async () => {
  if (film.paused) {
    await film.play();
    filmToggle.textContent = "Pause scan";
    filmToggle.setAttribute("aria-label", "Pause molecular scan");
  } else {
    film.pause();
    filmToggle.textContent = "Play scan";
    filmToggle.setAttribute("aria-label", "Play molecular scan");
  }
});

copyCommand.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(installCommand.textContent);
    copyCommand.textContent = "Copied";
    setTimeout(() => { copyCommand.textContent = "Copy"; }, 1500);
  } catch (_) {
    copyCommand.textContent = "Select";
  }
});

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  film.pause();
  filmToggle.textContent = "Play scan";
}

async function loadDownloadCount() {
  try {
    const response = await fetch(`${downloadMetricsUrl}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("metrics feed unavailable");
    const metrics = await response.json();
    let total = Number(metrics.website_total);
    if (!Number.isFinite(total) || total < downloadBaseline) throw new Error("outdated metrics feed");

    displayDownloadCount(total);
  } catch (_) {
    displayDownloadCount(downloadBaseline);
  }
}

loadDownloadCount();

(() => {
  const box = document.querySelector(".hero-quotes");
  if (!box) return;
  const quotes = [...box.querySelectorAll(".hero-quote")];
  const copy = document.querySelector(".hero-copy");
  const nav = document.querySelector(".nav-shell");
  let active = 0;
  let paused = false;
  const enabled = () => quotes.filter(quote => !quote.classList.contains("is-dropped"));
  const tooTall = () => copy.offsetTop < nav.offsetHeight + 12;

  function show(index) {
    const list = enabled();
    quotes.forEach(quote => quote.classList.remove("is-active"));
    if (!list.length) return;
    active = (index + list.length) % list.length;
    list[active].classList.add("is-active");
  }

  // Keep the headline clear of the menu: drop the tallest quotes until the block fits, or hide it.
  function fit() {
    box.classList.remove("is-hidden");
    quotes.forEach(quote => quote.classList.remove("is-dropped"));
    if (getComputedStyle(box).display === "none") return;
    while (tooTall()) {
      const list = enabled();
      const heights = list.map(quote => quote.offsetHeight);
      const tallest = Math.max(...heights);
      if (tallest <= Math.min(...heights)) { box.classList.add("is-hidden"); break; }
      list.forEach((quote, i) => { if (heights[i] === tallest) quote.classList.add("is-dropped"); });
    }
    show(0);
  }

  fit();
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 150); });
  if (quotes.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  box.addEventListener("mouseenter", () => { paused = true; });
  box.addEventListener("mouseleave", () => { paused = false; });
  box.addEventListener("focusin", () => { paused = true; });
  box.addEventListener("focusout", () => { paused = false; });
  setInterval(() => { if (!paused && !box.classList.contains("is-hidden")) show(active + 1); }, 6000);
})();
