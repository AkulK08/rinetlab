const film = document.getElementById("heroFilm");
const filmToggle = document.getElementById("filmToggle");
const copyCommand = document.getElementById("copyCommand");
const installCommand = document.getElementById("installCommand");
const demoDownloadAssetName = "rinet-structure-brief-demo.txt";
const downloadBaseline = 1658;
const downloadMetricsUrl = "https://raw.githubusercontent.com/AkulK08/rinetlab/main/metrics/downloads.json";
const feedbackDialog = document.getElementById("feedbackDialog");

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
  const display = document.getElementById("downloadCount");
  try {
    const response = await fetch(`${downloadMetricsUrl}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("metrics feed unavailable");
    const metrics = await response.json();
    let total = Number(metrics.website_total);
    if (!Number.isFinite(total)) throw new Error("invalid metrics feed");

    try {
      const liveResponse = await fetch("https://api.github.com/repos/AkulK08/rinetlab/releases/tags/v1.2.0-build012", { headers: { Accept: "application/vnd.github+json" } });
      if (liveResponse.ok) {
        const release = await liveResponse.json();
        const liveDemo = release.assets?.find(asset => asset.name === demoDownloadAssetName);
        const liveZip = release.assets?.find(asset => asset.name.endsWith(".zip"));
        const trackedDemo = metrics.instant_demo || {};
        const trackedZip = metrics.installer_and_zip || {};

        if (liveDemo) {
          total += liveDemo.id === trackedDemo.asset_id
            ? Math.max(0, Number(liveDemo.download_count) - Number(trackedDemo.raw_download_count || 0))
            : Number(liveDemo.download_count || 0);
        }
        if (liveZip) {
          total += liveZip.id === trackedZip.asset_id
            ? Math.max(0, Number(liveZip.download_count) - Number(trackedZip.raw_download_count || 0))
            : Number(liveZip.download_count || 0);
        }
      }
    } catch (_) {
      // The durable snapshot still provides the correct last recorded total.
    }

    display.textContent = `${total.toLocaleString()}+`;
  } catch (_) {
    try {
      const response = await fetch("https://api.github.com/repos/AkulK08/rinetlab/releases/tags/v1.2.0-build012", { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error("download count unavailable");
      const release = await response.json();
      const demoAsset = release.assets?.find(asset => asset.name === demoDownloadAssetName);
      const zipAsset = release.assets?.find(asset => asset.name.endsWith(".zip"));
      const total = downloadBaseline + Number(demoAsset?.download_count || 0) + Number(zipAsset?.download_count || 0);
      display.textContent = `${total.toLocaleString()}+`;
    } catch (_) {
      display.textContent = `${downloadBaseline.toLocaleString()}+`;
    }
  }
}

async function loadInstitutions() {
  const count = document.getElementById("institutionCount");
  try {
    const response = await fetch("https://api.github.com/repos/AkulK08/rinetlab-studio/issues?state=all&labels=research-use&per_page=100", { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error("institution count unavailable");
    const issues = (await response.json()).filter(issue => !issue.pull_request);
    const institutions = [...new Set(issues.map(issue => {
      const match = issue.body?.match(/\*\*Affiliation\*\*:\s*(.+)/i);
      return match?.[1]?.trim().toLowerCase();
    }).filter(Boolean))];
    count.textContent = String(Math.max(2, institutions.length));
  } catch (_) {
    count.textContent = "2";
  }
}

loadInstitutions();
loadDownloadCount();
