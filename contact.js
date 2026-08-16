const rinetContactRoute = `https://formsubmit.co/${atob("YWt1bGt1bWFyMDIwMDhAZ21haWwuY29t")}`;
const institutionCounterBase = "https://countapi.mileshilliard.com/api/v1";
const institutionTotalKey = "rinetlab-institutions-live-v1-e1a7c4";
const institutionBaseline = 2;

function institutionCountValue(payload) {
  const value = Number(payload?.value);
  return Number.isFinite(value) ? Math.max(institutionBaseline, value) : institutionBaseline;
}

function displayInstitutionCount(value) {
  document.querySelectorAll("[data-institution-count]").forEach(node => {
    node.textContent = String(Math.max(institutionBaseline, Number(value) || 0));
  });
}

async function loadInstitutionCount() {
  try {
    let response = await fetch(`${institutionCounterBase}/get/${institutionTotalKey}`, { cache: "no-store" });
    if (response.status === 404) response = await fetch(`${institutionCounterBase}/set/${institutionTotalKey}?value=${institutionBaseline}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Institution count unavailable");
    displayInstitutionCount(institutionCountValue(await response.json()));
  } catch (_) {
    displayInstitutionCount(institutionBaseline);
  }
}

function normalizeInstitution(value) {
  return value.normalize("NFKC").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function institutionFingerprint(value) {
  const bytes = new TextEncoder().encode(normalizeInstitution(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function registerInstitution(value) {
  const normalized = normalizeInstitution(value);
  if (!normalized) return;
  const markerKey = `rinetlab-institution-v1-${await institutionFingerprint(normalized)}`;
  const known = await fetch(`${institutionCounterBase}/get/${markerKey}`, { cache: "no-store", keepalive: true });
  if (known.ok) return;
  if (known.status !== 404) throw new Error("Institution registry unavailable");
  const marker = await fetch(`${institutionCounterBase}/hit/${markerKey}`, { cache: "no-store", keepalive: true });
  if (!marker.ok) throw new Error("Institution registry unavailable");
  const markerPayload = await marker.json();
  if (Number(markerPayload.value) !== 1) return;
  const total = await fetch(`${institutionCounterBase}/hit/${institutionTotalKey}`, { cache: "no-store", keepalive: true });
  if (!total.ok) throw new Error("Institution total unavailable");
  displayInstitutionCount(institutionCountValue(await total.json()));
}

function nextContactUrl() {
  const url = new URL(window.location.href);
  if (url.pathname.startsWith("/brief/")) url.search = "";
  url.searchParams.set("contact", "sent");
  url.hash = "contact";
  return url.toString();
}

document.querySelectorAll("[data-rinet-contact]").forEach(form => {
  form.action = rinetContactRoute;
  form.querySelector('input[name="_next"]')?.setAttribute("value", nextContactUrl());
  form.querySelector('input[name="_url"]')?.setAttribute("value", window.location.href);
  form.addEventListener("submit", async event => {
    if (!form.checkValidity() || form.querySelector('[name="_honey"]')?.value) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.firstChild.textContent = "Sending ";
    }
    const affiliation = form.querySelector('[name="affiliation"]')?.value || "";
    try {
      await Promise.race([
        registerInstitution(affiliation),
        new Promise(resolve => window.setTimeout(resolve, 2500))
      ]);
    } catch (_) {
      // Email delivery should never be blocked by the optional institution metric.
    }
    form.submit();
  });
});

const contactParams = new URLSearchParams(window.location.search);
if (contactParams.get("contact") === "sent") {
  document.querySelectorAll("[data-contact-status]").forEach(status => { status.textContent = "Message sent. Thank you."; });
  document.getElementById("contact")?.classList.add("sent");
  contactParams.delete("contact");
  const query = contactParams.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}#contact`);
}

loadInstitutionCount();
