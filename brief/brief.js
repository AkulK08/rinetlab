const els = {
  fileTab: document.getElementById("fileTab"), idTab: document.getElementById("idTab"),
  filePanel: document.getElementById("filePanel"), idPanel: document.getElementById("idPanel"),
  fileInput: document.getElementById("fileInput"), dropzone: document.getElementById("dropzone"),
  pdbForm: document.getElementById("pdbForm"), pdbId: document.getElementById("pdbId"),
  demoButton: document.getElementById("demoButton"), status: document.getElementById("status"),
  results: document.getElementById("results"), receiptForm: document.getElementById("receiptForm")
};

let current = null;
const molecular = { stage: null, component: null, representation: "surface", spinning: true, highlight: null };
const waterNames = new Set(["HOH", "WAT", "DOD"]);
const metalElements = new Set(["LI", "NA", "MG", "AL", "K", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "SR", "MO", "CD", "CS", "BA", "HG"]);

function switchSource(source) {
  const file = source === "file";
  els.fileTab.classList.toggle("active", file);
  els.idTab.classList.toggle("active", !file);
  els.fileTab.setAttribute("aria-selected", String(file));
  els.idTab.setAttribute("aria-selected", String(!file));
  els.filePanel.classList.toggle("hidden", !file);
  els.idPanel.classList.toggle("hidden", file);
  if (!file) els.pdbId.focus();
}

els.fileTab.addEventListener("click", () => switchSource("file"));
els.idTab.addEventListener("click", () => switchSource("id"));
els.dropzone.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => { if (els.fileInput.files[0]) readFile(els.fileInput.files[0]); });
["dragenter", "dragover"].forEach(event => els.dropzone.addEventListener(event, e => { e.preventDefault(); els.dropzone.classList.add("dragging"); }));
["dragleave", "drop"].forEach(event => els.dropzone.addEventListener(event, e => { e.preventDefault(); els.dropzone.classList.remove("dragging"); }));
els.dropzone.addEventListener("drop", e => { const file = e.dataTransfer.files[0]; if (file) readFile(file); });
els.demoButton.addEventListener("click", loadDemo);
els.pdbForm.addEventListener("submit", e => { e.preventDefault(); fetchPdb(els.pdbId.value); });

function setStatus(message, error = false) {
  els.status.textContent = message;
  els.status.classList.remove("hidden");
  els.status.classList.toggle("error", error);
}

async function readFile(file) {
  if (file.size > 25 * 1024 * 1024) setStatus("Large file detected. Analysis may take a moment on this device.");
  try {
    const text = await file.text();
    await analyze(text, file.name, "local-file");
  } catch (error) {
    setStatus(`Could not read this file: ${error.message}`, true);
  }
}

async function loadDemo() {
  if (els.demoButton.disabled) return;
  els.demoButton.disabled = true;
  fetch(`https://github.com/AkulK08/rinetlab/releases/download/v1.2.0-build012/rinet-structure-brief-demo.txt?t=${Date.now()}`, { mode: "no-cors", cache: "no-store", keepalive: true }).catch(() => {});
  setStatus("Loading the built-in 1CRN demonstration…");
  try {
    const response = await fetch("/brief/demo/1crn.pdb", { cache: "force-cache" });
    if (!response.ok) throw new Error(`demo asset returned ${response.status}`);
    await analyze(await response.text(), "1CRN demo", "built-in-demo");
  } catch (error) {
    setStatus(`Could not load the instant demo: ${error.message}.`, true);
  } finally {
    els.demoButton.disabled = false;
  }
}

async function fetchPdb(value) {
  const id = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(id)) return setStatus("Enter a four-character PDB identifier, such as 1CRN.", true);
  setStatus(`Fetching ${id} directly from RCSB PDB…`);
  try {
    const response = await fetch(`https://files.rcsb.org/download/${id}.pdb`);
    if (!response.ok) throw new Error(`RCSB returned ${response.status}`);
    const text = await response.text();
    await analyze(text, `${id}.pdb`, "rcsb-pdb");
  } catch (error) {
    setStatus(`Could not fetch ${id}: ${error.message}. You can download the PDB and use Local file instead.`, true);
  }
}

function parseAtom(line) {
  return {
    record: line.slice(0, 6).trim(), serial: Number(line.slice(6, 11)), atom: line.slice(12, 16).trim(),
    alt: line.slice(16, 17).trim(), residue: line.slice(17, 20).trim(), chain: line.slice(21, 22).trim() || "∅",
    seq: Number(line.slice(22, 26)), insertion: line.slice(26, 27).trim(), x: Number(line.slice(30, 38)),
    y: Number(line.slice(38, 46)), z: Number(line.slice(46, 54)), occupancy: Number(line.slice(54, 60)),
    b: Number(line.slice(60, 66)), element: (line.slice(76, 78).trim() || line.slice(12, 14).trim()).toUpperCase()
  };
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
function median(values) { const s = [...values].sort((a,b) => a-b); return s.length ? (s[Math.floor((s.length-1)/2)] + s[Math.ceil((s.length-1)/2)]) / 2 : null; }
function esc(value) { return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]); }

function parsePdb(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const atomLines = lines.filter(line => line.startsWith("ATOM  ") || line.startsWith("HETATM"));
  if (!atomLines.length) throw new Error("No ATOM or HETATM coordinate records were found");
  const allAtoms = atomLines.map(parseAtom).filter(a => [a.x, a.y, a.z].every(Number.isFinite));
  const alternateCount = allAtoms.filter(a => a.alt && a.alt !== "A").length;
  const atoms = allAtoms.filter(a => !a.alt || a.alt === "A");
  const polymerAtoms = atoms.filter(a => a.record === "ATOM");
  if (!polymerAtoms.length) throw new Error("No polymer ATOM records were found");
  const residueMap = new Map();
  polymerAtoms.forEach(atom => {
    const key = `${atom.chain}:${atom.seq}:${atom.insertion}:${atom.residue}`;
    if (!residueMap.has(key)) residueMap.set(key, { key, chain: atom.chain, seq: atom.seq, insertion: atom.insertion, name: atom.residue, atoms: [], ca: null });
    const residue = residueMap.get(key); residue.atoms.push(atom); if (atom.atom === "CA") residue.ca = atom;
  });
  const residues = [...residueMap.values()];
  const chains = new Map();
  residues.forEach(residue => { if (!chains.has(residue.chain)) chains.set(residue.chain, []); chains.get(residue.chain).push(residue); });
  const degree = new Map(residues.map(r => [r.key, 0]));
  const cas = residues.filter(r => r.ca);
  let contacts = 0;
  for (let i = 0; i < cas.length; i += 1) for (let j = i + 1; j < cas.length; j += 1) {
    const a = cas[i], b = cas[j];
    if (a.chain === b.chain && Math.abs(a.seq - b.seq) <= 2) continue;
    if (distance(a.ca, b.ca) <= 8.0) { contacts += 1; degree.set(a.key, degree.get(a.key) + 1); degree.set(b.key, degree.get(b.key) + 1); }
  }
  const chainReports = [...chains.entries()].map(([chain, items]) => {
    items.sort((a,b) => a.seq - b.seq || a.insertion.localeCompare(b.insertion));
    let breaks = 0;
    for (let i = 1; i < items.length; i += 1) {
      const seqGap = items[i].seq - items[i-1].seq > 1;
      const spatialBreak = items[i].ca && items[i-1].ca && distance(items[i].ca, items[i-1].ca) > 4.5;
      if (seqGap || spatialBreak) breaks += 1;
    }
    return { chain, residues: items.length, atoms: items.reduce((sum,r) => sum + r.atoms.length, 0), start: items[0]?.seq, end: items.at(-1)?.seq, breaks };
  });
  const hetero = new Map(); const waters = [];
  atoms.filter(a => a.record === "HETATM").forEach(atom => {
    if (waterNames.has(atom.residue)) return waters.push(atom);
    const key = `${atom.residue}:${atom.chain}:${atom.seq}`;
    if (!hetero.has(key)) hetero.set(key, { name: atom.residue, chain: atom.chain, seq: atom.seq, elements: new Set() });
    hetero.get(key).elements.add(atom.element);
  });
  const metals = [...hetero.values()].filter(group => [...group.elements].some(element => metalElements.has(element)));
  const bValues = polymerAtoms.map(a => a.b).filter(Number.isFinite);
  const lowOccupancy = polymerAtoms.filter(a => Number.isFinite(a.occupancy) && a.occupancy < .999).length;
  const missingCa = residues.filter(r => !r.ca).length;
  const topResidues = residues.map(r => ({ label: `${r.name} ${r.chain}:${r.seq}${r.insertion}`, name: r.name, chain: r.chain, seq: r.seq, insertion: r.insertion, degree: degree.get(r.key) })).sort((a,b) => b.degree - a.degree || a.label.localeCompare(b.label)).slice(0, 5);
  return {
    residues: residues.length, polymerAtoms: polymerAtoms.length, chainReports, contacts, alternateCount, lowOccupancy, missingCa,
    waters: waters.length, hetero: [...hetero.values()].map(group => `${group.name} ${group.chain}:${group.seq}`), metals: metals.map(group => `${group.name} ${group.chain}:${group.seq}`),
    bMean: bValues.length ? bValues.reduce((sum,v) => sum+v,0)/bValues.length : null, bMedian: median(bValues), topResidues,
    models: lines.filter(line => line.startsWith("MODEL ")).length || 1
  };
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function analyze(text, sourceName, sourceType) {
  setStatus(`Analyzing ${sourceName} locally…`);
  try {
    const report = parsePdb(text);
    const digest = await sha256(text);
    const receiptId = `RNB-${digest.slice(0, 12).toUpperCase()}`;
    current = { sourceName, sourceType, digest, receiptId, report, rawText: text, analyzedAt: new Date().toISOString() };
    render(current);
    setStatus(`Complete. ${sourceName} was parsed locally; no coordinates were sent to RINet.`);
  } catch (error) {
    setStatus(`Analysis stopped: ${error.message}. Confirm that this is a fixed-column PDB file.`, true);
  }
}

function render(data) {
  const r = data.report;
  document.getElementById("structureName").textContent = data.sourceName;
  document.getElementById("receiptId").textContent = data.receiptId;
  document.getElementById("residueMetric").textContent = r.residues.toLocaleString();
  document.getElementById("atomMetric").textContent = r.polymerAtoms.toLocaleString();
  document.getElementById("chainMetric").textContent = r.chainReports.length.toLocaleString();
  document.getElementById("contactMetric").textContent = r.contacts.toLocaleString();
  document.getElementById("bMetric").textContent = r.bMean === null ? "N/A" : r.bMean.toFixed(1);
  document.getElementById("chainRows").innerHTML = r.chainReports.map(chain => `<tr><td>${esc(chain.chain)}</td><td>${chain.residues}</td><td>${chain.atoms}</td><td>${chain.start}–${chain.end}</td><td>${chain.breaks}</td></tr>`).join("");
  document.getElementById("inventory").textContent = `${r.models} model record${r.models === 1 ? "" : "s"} · ${r.hetero.length} non-water hetero group${r.hetero.length === 1 ? "" : "s"} · ${r.waters} water atom${r.waters === 1 ? "" : "s"}${r.hetero.length ? ` · Hetero inventory: ${r.hetero.slice(0,8).join(", ")}${r.hetero.length > 8 ? "…" : ""}` : ""}`;
  const flags = [
    { warn: r.chainReports.some(c => c.breaks), title: `${r.chainReports.reduce((s,c)=>s+c.breaks,0)} sequence gap / backbone break flags`, note: "Flags combine residue-number gaps and consecutive Cα distances above 4.5 Å." },
    { warn: r.missingCa > 0, title: `${r.missingCa} residues without Cα coordinates`, note: "These residues are omitted from the Cα contact calculation." },
    { warn: r.lowOccupancy > 0, title: `${r.lowOccupancy} polymer atoms below full occupancy`, note: "Inspect alternate states and occupancy semantics before quantitative interpretation." },
    { warn: r.alternateCount > 0, title: `${r.alternateCount} alternate-location atom records beyond blank/A`, note: "The brief uses blank or A conformers for descriptive geometry." },
    { warn: false, title: r.metals.length ? `Potential metal groups: ${r.metals.join(", ")}` : "No metal groups detected", note: "Detection uses element labels and does not assign coordination chemistry." }
  ];
  document.getElementById("flagList").innerHTML = flags.map(flag => `<div class="flag ${flag.warn ? "warn" : ""}"><i></i><div><strong>${esc(flag.title)}</strong><span>${esc(flag.note)}</span></div></div>`).join("");
  document.getElementById("topologyRows").innerHTML = r.topResidues.map((residue, i) => `<div class="topology-row"><strong>${String(i+1).padStart(2,"0")} / ${esc(residue.label)}</strong><span>CONTACT DEGREE ${residue.degree}</span></div>`).join("");
  document.getElementById("bestResidueRows").innerHTML = r.topResidues.map((residue, i) => `<button class="best-residue-row" type="button" data-residue-index="${i}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(residue.label)}</strong><small>DEG ${residue.degree}</small></button>`).join("");
  const methods = `Coordinates from ${data.sourceName} were parsed locally with RINet Structure Brief 1.0 (receipt ${data.receiptId}). The analyzed model contained ${r.residues} polymer residues and ${r.polymerAtoms} polymer atoms across ${r.chainReports.length} chain${r.chainReports.length === 1 ? "" : "s"}. A descriptive residue-contact graph was constructed between Cα atoms separated by no more than 8.0 Å, excluding residues within two sequence positions on the same chain, yielding ${r.contacts} contacts. Coordinate-record screening flagged ${r.chainReports.reduce((s,c)=>s+c.breaks,0)} sequence gap or backbone break${r.chainReports.reduce((s,c)=>s+c.breaks,0) === 1 ? "" : "s"}, ${r.lowOccupancy} polymer atoms below full occupancy and ${r.missingCa} residues without Cα coordinates. B-factor fields were summarized descriptively (mean ${r.bMean === null ? "not available" : r.bMean.toFixed(2)}); they were not assumed to represent prediction confidence. Contact degree and flags are geometric descriptors and were not interpreted as causal or functional proof.`;
  document.getElementById("methodsText").textContent = methods;
  els.results.classList.remove("hidden");
  renderMolecule(data.rawText, data.sourceName, r.topResidues);
  els.results.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function setMolecularRepresentation(type) {
  molecular.representation = type;
  if (!molecular.component) return;
  molecular.component.removeAllRepresentations();
  if (type === "surface") {
    molecular.component.addRepresentation("surface", { sele: "protein", surfaceType: "av", probeRadius: 1.4, scaleFactor: 2.0, colorScheme: "residueindex", opacity: .9, roughness: .35 });
    molecular.component.addRepresentation("cartoon", { sele: "protein", color: "#baf6e8", opacity: .28, quality: "high" });
  } else {
    molecular.component.addRepresentation("cartoon", { sele: "protein", colorScheme: "residueindex", quality: "high", aspectRatio: 5.0 });
    molecular.component.addRepresentation("ball+stick", { sele: "not protein and not water", colorScheme: "element" });
  }
  document.querySelectorAll("[data-representation]").forEach(button => button.classList.toggle("active", button.dataset.representation === type));
}

async function renderMolecule(text, label, topResidues) {
  if (!window.NGL) return;
  if (!molecular.stage) {
    molecular.stage = new NGL.Stage("moleculeStage", { backgroundColor: "#080b09", cameraType: "perspective", quality: "high", sampleLevel: 1 });
    molecular.stage.setParameters({ backgroundColor: "#080b09", fogNear: 50, fogFar: 100, lightIntensity: 1.1, ambientIntensity: .42 });
    window.addEventListener("resize", () => molecular.stage.handleResize());
  }
  molecular.stage.removeAllComponents(); molecular.component = null; molecular.highlight = null;
  document.getElementById("viewerLabel").textContent = label;
  const blob = new Blob([text], { type: "text/plain" });
  Object.defineProperty(blob, "name", { value: label });
  try {
    molecular.component = await molecular.stage.loadFile(blob, { ext: label.toLowerCase().endsWith(".cif") || label.toLowerCase().endsWith(".mmcif") ? "cif" : "pdb", defaultRepresentation: false });
    setMolecularRepresentation(molecular.representation);
    molecular.component.autoView(500);
    molecular.stage.setSpin([0, 1, .08], .0022);
    molecular.spinning = true;
    document.getElementById("viewerSpin").textContent = "Pause";
    document.querySelectorAll(".best-residue-row").forEach(button => button.addEventListener("click", () => highlightResidue(topResidues[Number(button.dataset.residueIndex)], button)));
  } catch (error) {
    document.getElementById("viewerLabel").textContent = `Viewer unavailable: ${error.message}`;
  }
}

function highlightResidue(residue, button) {
  if (!molecular.component || !residue) return;
  if (molecular.highlight) molecular.component.removeRepresentation(molecular.highlight);
  const selection = `${residue.seq}${residue.insertion || ""}${residue.chain === "∅" ? "" : `:${residue.chain}`}`;
  molecular.highlight = molecular.component.addRepresentation("ball+stick", { sele: selection, color: "#d9ff58", scale: 1.45, quality: "high" });
  molecular.component.autoView(selection, 450);
  document.querySelectorAll(".best-residue-row").forEach(row => row.classList.toggle("active", row === button));
}

document.querySelectorAll("[data-representation]").forEach(button => button.addEventListener("click", () => setMolecularRepresentation(button.dataset.representation)));
document.getElementById("viewerFit").addEventListener("click", () => molecular.component?.autoView(450));
document.getElementById("viewerSpin").addEventListener("click", event => {
  if (!molecular.stage) return;
  molecular.spinning = !molecular.spinning;
  molecular.stage.setSpin(molecular.spinning ? [0, 1, .08] : false, .0022);
  event.currentTarget.textContent = molecular.spinning ? "Pause" : "Spin";
});

document.getElementById("copyMethods").addEventListener("click", async e => {
  try { await navigator.clipboard.writeText(document.getElementById("methodsText").textContent); e.currentTarget.textContent = "Copied"; setTimeout(() => e.currentTarget.textContent = "Copy paragraph", 1500); }
  catch (_) { e.currentTarget.textContent = "Select + copy"; }
});

function receiptPayload() {
  return { tool: "RINet Structure Brief", version: "1.0", receiptId: current.receiptId, analyzedAt: current.analyzedAt, sourceLabel: current.sourceName, sourceType: current.sourceType, structureSha256: current.digest, summary: current.report, scientificBoundary: "Descriptive coordinate and Cα contact analysis; not functional or causal proof." };
}

document.getElementById("downloadReceipt").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(receiptPayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${current.receiptId.toLowerCase()}-structure-brief.json`; link.click(); URL.revokeObjectURL(link.href);
});

els.receiptForm.addEventListener("submit", event => {
  event.preventDefault(); if (!current || !els.receiptForm.reportValidity()) return;
  const affiliation = document.getElementById("affiliation").value.trim();
  const researcher = document.getElementById("researcher").value.trim() || "Not provided";
  const field = document.getElementById("field").value.trim() || "Not provided";
  const feedback = document.getElementById("feedback").value.trim();
  const title = `Research receipt · ${affiliation} · ${current.receiptId}`;
  const body = `## RINet Structure Brief research-use receipt\n\n**Affiliation**: ${affiliation}\n**Researcher / lab**: ${researcher}\n**Research area**: ${field}\n**Receipt**: ${current.receiptId}\n**Input label**: ${current.sourceName}\n**Structure SHA-256**: \`${current.digest}\`\n\n### One-line feedback\n${feedback}\n\n### Analysis summary\n- ${current.report.residues} polymer residues across ${current.report.chainReports.length} chain(s)\n- ${current.report.polymerAtoms} polymer atoms\n- ${current.report.contacts} descriptive Cα contacts at 8.0 Å\n- ${current.report.chainReports.reduce((s,c)=>s+c.breaks,0)} sequence gap / backbone break flags\n\n> Coordinates were analyzed locally and are not attached. This public receipt documents use of the utility; it is not an endorsement of scientific conclusions.\n\n<!-- Keep the research-use label so this receipt appears in the public ledger. -->`;
  const url = `https://github.com/AkulK08/rinetlab-studio/issues/new?labels=research-use&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

if (new URLSearchParams(window.location.search).get("demo") === "1") loadDemo();
