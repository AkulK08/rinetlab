const film = document.getElementById("heroFilm");
const filmToggle = document.getElementById("filmToggle");
const copyCommand = document.getElementById("copyCommand");
const installCommand = document.getElementById("installCommand");
const demoDownloadAssetName = "rinet-structure-brief-demo.txt";
const downloadBaseline = 5500;

document.getElementById("year").textContent = new Date().getFullYear();
film.defaultPlaybackRate = 0.4;
film.playbackRate = 0.4;
film.addEventListener("loadedmetadata", () => { film.playbackRate = 0.4; }, { once: true });

const pageParams = new URLSearchParams(window.location.search);
if (pageParams.get("contact") === "sent") {
  const contact = document.getElementById("contact");
  const status = document.getElementById("contactStatus");
  contact?.classList.add("sent");
  if (status) status.textContent = "Feedback sent. Thank you.";
  window.history.replaceState({}, "", `${window.location.pathname}#contact`);
}

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
  const display = document.getElementById("downloadCount");
  try {
    const response = await fetch("https://api.github.com/repos/AkulK08/rinetlab/releases/tags/v1.2.0-build012", { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error("download count unavailable");
    const release = await response.json();
    const demoAsset = release.assets?.find(asset => asset.name === demoDownloadAssetName);
    const total = downloadBaseline + Number(demoAsset?.download_count || 0);
    display.textContent = `${total.toLocaleString()}+`;
  } catch (_) {
    display.textContent = `${downloadBaseline.toLocaleString()}+`;
  }
}

async function loadReceipts() {
  const count = document.getElementById("receiptCount");
  const list = document.getElementById("institutionList");
  try {
    const response = await fetch("https://api.github.com/repos/AkulK08/rinetlab-studio/issues?state=all&labels=research-use&per_page=100", { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error("ledger unavailable");
    const issues = (await response.json()).filter(issue => !issue.pull_request);
    count.textContent = String(Math.max(2, issues.length));
    const institutions = [...new Set(issues.map(issue => {
      const match = issue.body?.match(/\*\*Affiliation\*\*:\s*(.+)/i);
      return match?.[1]?.trim();
    }).filter(Boolean))].slice(0, 8);
    if (institutions.length) list.textContent = institutions.join(" · ");
    else list.textContent = "Two early university researchers. Public affiliations appear here as researchers opt in.";
  } catch (_) {
    count.textContent = "2";
    list.textContent = "Two early university researchers. Public affiliations appear here as researchers opt in.";
  }
}

loadReceipts();
loadDownloadCount();
