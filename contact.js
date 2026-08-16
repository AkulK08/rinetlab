const rinetContactRoute = "https://docs.google.com/forms/d/e/1FAIpQLSekauigVwUPRU0-dN_20x_JDG3fR8QVAPe-r7VKfqygg3I9nQ/formResponse";
const rinetContactFields = {
  email: "entry.399291716",
  message: "entry.1285651083",
  name: "entry.1381481693",
  affiliation: "entry.1710127868"
};
const institutionCounterBase = "https://countapi.mileshilliard.com/api/v1";
const institutionTotalKey = "rinetlab-institutions-live-v1-e1a7c4";
const institutionBaseline = 3;

function institutionCountValue(payload) {
  const value = Number(payload?.value);
  return Number.isFinite(value) ? Math.max(institutionBaseline, value) : institutionBaseline;
}

function displayInstitutionCount(value) {
  const nextValue = String(Math.max(institutionBaseline, Number(value) || 0));
  document.querySelectorAll("[data-institution-count]").forEach(node => {
    if (node.textContent !== nextValue) node.textContent = nextValue;
    node.classList.add("is-ready");
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

let contactToastTimer = null;

function showContactToast(message, error = false) {
  let toast = document.getElementById("rinetContactToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "rinetContactToast";
    toast.className = "rinet-contact-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = '<span>RINet contact</span><strong></strong><button type="button" aria-label="Close message">Close</button>';
    toast.querySelector("button").addEventListener("click", () => toast.classList.remove("visible"));
    document.body.appendChild(toast);
  }
  toast.querySelector("strong").textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("visible");
  window.clearTimeout(contactToastTimer);
  contactToastTimer = window.setTimeout(() => toast.classList.remove("visible"), 5200);
}

document.querySelectorAll("[data-rinet-contact]").forEach(form => {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (form.querySelector('[name="_honey"]')?.value) return;
    const button = form.querySelector('button[type="submit"]');
    const originalButton = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = "Sending <span>···</span>";
    }
    const affiliation = form.querySelector('[name="affiliation"]')?.value || "";
    try {
      const formData = new FormData(form);
      const payload = new URLSearchParams({
        [rinetContactFields.name]: String(formData.get("name") || ""),
        [rinetContactFields.affiliation]: String(formData.get("affiliation") || ""),
        [rinetContactFields.email]: String(formData.get("email") || ""),
        [rinetContactFields.message]: String(formData.get("message") || ""),
        fvv: "1",
        pageHistory: "0",
        submit: "Submit"
      });
      await fetch(rinetContactRoute, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        keepalive: true,
        body: payload
      });
      await Promise.race([
        registerInstitution(affiliation),
        new Promise(resolve => window.setTimeout(resolve, 2500))
      ]);
      form.reset();
      document.querySelectorAll("[data-contact-status]").forEach(status => { status.textContent = "Message sent. Thank you."; });
      form.closest("dialog")?.close();
      showContactToast("Message sent. We’ll get back to you soon.");
    } catch (error) {
      showContactToast("That message did not send. Please try again.", true);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalButton;
      }
    }
  });
});

loadInstitutionCount();
