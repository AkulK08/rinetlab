const els = {
  fileTab: document.getElementById("fileTab"), idTab: document.getElementById("idTab"),
  filePanel: document.getElementById("filePanel"), idPanel: document.getElementById("idPanel"),
  fileInput: document.getElementById("fileInput"), dropzone: document.getElementById("dropzone"),
  pdbForm: document.getElementById("pdbForm"), pdbId: document.getElementById("pdbId"),
  resultPdbForm: document.getElementById("resultPdbForm"), resultPdbId: document.getElementById("resultPdbId"),
  demoButton: document.getElementById("demoButton"), status: document.getElementById("status"),
  analysisStatus: document.getElementById("analysisStatus"), results: document.getElementById("results")
};

let current = null;
const molecular = { stage: null, component: null, representation: "surface", colorMode: "chain", background: "black", spinning: false, highlight: null, topResidues: [], resultScheme: null, selectedResidue: null };
let activeDiscoveryMode = "biology";
let activeScoringLens = "general";
let activeSequenceChain = null;
let userHypothesis = "";
let suggestedHypothesisActive = false;
const preview = { stage: null, component: null };
const demoTour = { timer: null, frame: null, active: false };
const waterNames = new Set(["HOH", "WAT", "DOD"]);
const metalElements = new Set(["LI", "NA", "MG", "AL", "K", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "SR", "MO", "CD", "CS", "BA", "HG"]);
const aminoAcidOneLetter = { ALA:"A", ARG:"R", ASN:"N", ASP:"D", CYS:"C", GLN:"Q", GLU:"E", GLY:"G", HIS:"H", ILE:"I", LEU:"L", LYS:"K", MET:"M", PHE:"F", PRO:"P", SER:"S", THR:"T", TRP:"W", TYR:"Y", VAL:"V", SEC:"U", PYL:"O" };
const featureLabels = { degree:"Contact degree", weighted:"Distance-weighted packing", longRange:"Long-range contacts", interchain:"Cross-chain contacts", closeness:"Closeness centrality", betweenness:"Betweenness centrality", burial:"Radial burial", ligand:"Ligand proximity", coordination:"Direct metal coordination", cdr:"CDR-region evidence" };
const scoreLenses = {
  general: { label:"General", description:"General model: contacts, centrality, burial, ligand distance and direct metal coordination use the displayed weights.", weights:{ degree:.15, weighted:.10, longRange:.10, interchain:.12, closeness:.10, betweenness:.08, burial:.05, ligand:.15, coordination:.15, cdr:0 } },
  ligand: { label:"Ligand", description:"Ligand model: increases the weights for bound-group distance and direct metal coordination.", weights:{ degree:.08, weighted:.08, longRange:.05, interchain:.04, closeness:.07, betweenness:.06, burial:.06, ligand:.36, coordination:.20, cdr:0 } },
  interface: { label:"Interface", description:"Interface model: increases the weights for cross-chain contacts and graph bottlenecks. Check the biological assembly and crystal contacts.", weights:{ degree:.14, weighted:.10, longRange:.09, interchain:.38, closeness:.09, betweenness:.12, burial:.08, ligand:0, coordination:0, cdr:0 } },
  allostery: { label:"Allostery", description:"Allostery model: increases the weights for long-range contacts, closeness and betweenness. It does not prove energetic coupling.", weights:{ degree:.10, weighted:.07, longRange:.22, interchain:.13, closeness:.15, betweenness:.25, burial:.04, ligand:.04, coordination:0, cdr:0 } },
  stability: { label:"Stability", description:"Stability model: increases the weights for contact packing and burial. Test expression and fold before interpreting function.", weights:{ degree:.18, weighted:.22, longRange:.10, interchain:.10, closeness:.10, betweenness:.08, burial:.20, ligand:.02, coordination:0, cdr:0 } },
  antibody: { label:"Antibody / CDR", description:"Antibody model: adds variable-loop evidence when antibody-like sequence context is detected. Verify CDR numbering and antigen contacts externally.", weights:{ degree:.10, weighted:.06, longRange:.05, interchain:.25, closeness:.08, betweenness:.08, burial:.02, ligand:.10, coordination:0, cdr:.26 } }
};
const benchmarkManifest = {
  "4HHB": { status:"Curated structural-anchor sanity check", source:"https://www.rcsb.org/structure/4HHB", citation:"4HHB primary structure and heme coordination", sites:["HIS A:87","HIS B:92","HIS C:87","HIS D:92"], note:"Proximal F8 histidines coordinate heme iron. Labels are evaluated after ranking and contribute no score." },
  "5DTL": { status:"Curated published-site sanity check", source:"https://doi.org/10.1021/jacs.5b09923", citation:"Arginine 66 controls dark-state formation in mEos2", sites:["ARG A:66","ARG B:66","ARG C:66","ARG D:66","ARG E:66"], note:"Published Arg66 site. Chain copies are evaluated independently and contribute no score." }
};
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const sectionTargets = sectionLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);

function setActiveSection(index) {
  const bounded = Math.max(0, Math.min(index, sectionLinks.length - 1));
  document.body.dataset.activeSection = String(bounded);
  sectionLinks.forEach((link, linkIndex) => {
    const active = linkIndex === bounded;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  const currentElement = document.getElementById("sectionCurrent");
  const labelElement = document.getElementById("sectionLabel");
  if (currentElement) currentElement.textContent = String(bounded + 1);
  if (labelElement) labelElement.textContent = sectionLinks[bounded]?.dataset.sectionLabel || "Structure";
}

function activeSectionIndex() {
  if (!sectionTargets.length) return 0;
  const marker = window.scrollY + Math.min(window.innerHeight * .34, 300);
  let active = 0;
  sectionTargets.forEach((section, index) => {
    if (section.offsetTop <= marker) active = index;
  });
  return active;
}

function updateSectionRail() {
  if (!document.body.classList.contains("analysis-mode") || !sectionTargets.length) return;
  setActiveSection(activeSectionIndex());
}

sectionLinks.forEach((link, index) => link.addEventListener("click", event => {
  event.preventDefault();
  stopDemoTour();
  setActiveSection(index);
  sectionTargets[index]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}));

function switchSource(source, focusInput = true) {
  const file = source === "file";
  els.fileTab.classList.toggle("active", file);
  els.idTab.classList.toggle("active", !file);
  els.fileTab.setAttribute("aria-selected", String(file));
  els.idTab.setAttribute("aria-selected", String(!file));
  els.filePanel.classList.toggle("hidden", !file);
  els.idPanel.classList.toggle("hidden", file);
  if (!file && focusInput) els.pdbId.focus({ preventScroll: true });
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
els.resultPdbForm.addEventListener("submit", e => { e.preventDefault(); fetchPdb(els.resultPdbId.value); });

function setStatus(message, error = false) {
  els.status.textContent = message;
  els.status.classList.remove("hidden");
  els.status.classList.toggle("error", error);
  if (els.analysisStatus) {
    els.analysisStatus.textContent = message;
    els.analysisStatus.classList.toggle("error", error);
  }
}

function stopDemoTour() {
  if (demoTour.timer) window.clearTimeout(demoTour.timer);
  if (demoTour.frame) window.cancelAnimationFrame(demoTour.frame);
  demoTour.timer = null;
  demoTour.frame = null;
  demoTour.active = false;
  document.getElementById("demoSkipStatus")?.classList.remove("active");
}

function demoTourStops() {
  return [...sectionTargets.slice(1), document.getElementById("analysisEnd")].filter(Boolean);
}

function atPageBottom() {
  return window.scrollY >= Math.max(0, document.documentElement.scrollHeight - window.innerHeight) - 2;
}

function scheduleDemoTour(delay = 6500) {
  stopDemoTour();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || atPageBottom()) return updateResultScrollCue();
  const status = document.getElementById("demoSkipStatus");
  demoTour.active = true;
  status?.classList.remove("active");
  if (status) void status.offsetWidth;
  status?.classList.add("active");
  demoTour.timer = window.setTimeout(advanceDemoTour, delay);
}

function glideDemoTo(targetY, duration = 1350) {
  const startY = window.scrollY;
  const pageBottom = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const destination = Math.max(0, Math.min(targetY, pageBottom));
  const distance = destination - startY;
  const startedAt = performance.now();
  demoTour.active = true;
  const step = now => {
    if (!demoTour.active) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, startY + distance * eased);
    if (progress < 1) return void (demoTour.frame = window.requestAnimationFrame(step));
    demoTour.frame = null;
    demoTour.active = false;
    updateResultScrollCue();
    if (!atPageBottom()) scheduleDemoTour();
  };
  demoTour.frame = window.requestAnimationFrame(step);
}

function advanceDemoTour() {
  stopDemoTour();
  if (!document.body.classList.contains("demo-mode") || atPageBottom()) return updateResultScrollCue();
  const next = demoTourStops().find(section => section.getBoundingClientRect().top + window.scrollY > window.scrollY + 28);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const destination = next ? next.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight;
  if (reducedMotion) {
    window.scrollTo(0, destination);
    updateResultScrollCue();
    return;
  }
  glideDemoTo(destination);
}

["wheel", "touchstart", "pointerdown"].forEach(eventName => window.addEventListener(eventName, stopDemoTour, { passive: true }));
window.addEventListener("keydown", stopDemoTour);

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
  fetch(`https://github.com/AkulK08/rinetlab/releases/download/v1.3.0-build013/rinet-structure-brief-demo.txt?t=${Date.now()}`, { mode: "no-cors", cache: "no-store", keepalive: true }).catch(() => {});
  setStatus("Loading the built-in 4HHB human deoxyhemoglobin demonstration…");
  try {
    const response = await fetch("/brief/demo/4hhb.pdb", { cache: "force-cache" });
    if (!response.ok) throw new Error(`demo asset returned ${response.status}`);
    await analyze(await response.text(), "4HHB · human deoxyhemoglobin", "built-in-demo");
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
    let response = await fetch(`https://files.rcsb.org/download/${id}.pdb`);
    let format = "pdb";
    if (!response.ok) {
      setStatus(`${id} is not available in legacy PDB format. Trying mmCIF for large or newly released structures…`);
      response = await fetch(`https://files.rcsb.org/download/${id}.cif`);
      format = "cif";
    }
    if (!response.ok) throw new Error(`RCSB returned ${response.status} for both PDB and mmCIF`);
    const text = await response.text();
    await analyze(text, `${id}.${format}`, `rcsb-${format}`);
  } catch (error) {
    setStatus(`Could not fetch ${id}: ${error.message}. Download its PDB or mmCIF record and use Local file instead.`, true);
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
function residueClass(name) {
  if (["ARG", "LYS", "HIS"].includes(name)) return "basic";
  if (["ASP", "GLU"].includes(name)) return "acidic";
  if (["SER", "THR", "ASN", "GLN", "CYS"].includes(name)) return "polar";
  if (["PHE", "TYR", "TRP"].includes(name)) return "aromatic";
  if (["GLY", "PRO"].includes(name)) return "backbone-special";
  return "hydrophobic";
}
function mutationSuggestion(residue) {
  const substitutions = { ASP: "D→N", GLU: "E→Q", LYS: "K→Q", ARG: "R→Q", CYS: "C→S", ALA: "A→G", GLY: "G→A", PRO: "P→A" };
  return substitutions[residue?.name] || `${residue?.name || "Residue"}→Ala`;
}

function mutationLadder(residue) {
  const name = residue?.name || "Residue";
  const conservative = { ARG: "R→K", LYS: "K→R", ASP: "D→E", GLU: "E→D", ASN: "N→Q", GLN: "Q→N", SER: "S→T", THR: "T→S", PHE: "F→Y", TYR: "Y→F", TRP: "W→F", LEU: "L→I", ILE: "I→V", VAL: "V→I", MET: "M→L", CYS: "C→S", HIS: "H→N", ALA: "A→G", GLY: "G→A", PRO: "P→A" };
  const neutral = { ARG: "R→Q", LYS: "K→Q", ASP: "D→N", GLU: "E→Q", HIS: "H→A", SER: "S→A", THR: "T→A", ASN: "N→A", GLN: "Q→A", CYS: "C→A" };
  const stress = { ARG: "R→E", LYS: "K→E", ASP: "D→K", GLU: "E→K", HIS: "H→E", GLY: "G→P", PRO: "P→G" };
  return {
    conservative: conservative[name] || `${name}→similar residue`,
    neutral: neutral[name] || `${name}→Ala`,
    stress: residue?.disulfidePartner ? `${residue.disulfidePartner.label.replace("CYS ", "Cys ")}→Ser` : (stress[name] || `${name}→Pro`)
  };
}

function mutationRationale(residue, substitution = mutationLadder(residue).conservative) {
  const chemistry = {
    ASN:"Asparagine is a neutral amide. N→Q retains the amide donor/acceptor pattern while adding one methylene, testing side-chain reach and hydrogen-bond geometry without claiming that the fold will be preserved.",
    GLN:"Glutamine is a neutral amide. Q→N retains the amide while shortening the side chain by one methylene, testing geometric reach.",
    ASP:"Aspartate is negatively charged near neutral pH. D→E preserves charge while lengthening the side chain; D→N removes charge while retaining an amide-sized polar group.",
    GLU:"Glutamate is negatively charged near neutral pH. E→D preserves charge while shortening reach; E→Q removes charge while retaining similar size.",
    LYS:"Lysine is usually positively charged. K→R preserves positive charge with different geometry; K→Q removes charge while keeping a long polar side chain.",
    ARG:"Arginine is usually positively charged and offers directional guanidinium contacts. R→K preserves charge with fewer hydrogen-bonding geometries; R→Q removes charge.",
    HIS:"Histidine can change protonation and coordinate metals. H→N removes the imidazole ring and cannot preserve direct metal coordination; at a metal-linked site it is an intentionally disruptive mechanistic probe, so heme/metal occupancy and fold must be measured first.",
    CYS:"Cysteine can be redox-active or disulfide-bonded. C→S replaces sulfur with oxygen; if a disulfide is present, fold and assembly are the primary readouts.",
    GLY:"Glycine uniquely lacks a side chain. G→A adds a methyl group and tests backbone-space tolerance rather than a simple chemical feature.",
    PRO:"Proline constrains backbone geometry. P→A removes that constraint and may alter local secondary structure.",
    PHE:"Phenylalanine is aromatic and hydrophobic. F→Y preserves the aromatic ring while adding a hydroxyl.",
    TYR:"Tyrosine is aromatic with a hydroxyl. Y→F preserves the ring while removing hydrogen-bond donation.",
    TRP:"Tryptophan is a large aromatic side chain. W→F reduces size while retaining aromaticity.",
    SER:"Serine is a small hydroxyl-bearing residue. S→T preserves the hydroxyl while adding a methyl group.",
    THR:"Threonine is a branched hydroxyl-bearing residue. T→S preserves the hydroxyl while reducing steric bulk."
  };
  return `${substitution}: ${chemistry[residue?.name] || `${residue?.name || "This residue"} is changed first with the least severe available property-aware substitution; packing and fold preservation still require measurement.`}`;
}

function pdbRecord(lines, prefix, start = 10) {
  return lines.filter(line => line.startsWith(prefix)).map(line => line.slice(start).trim()).join(" ").replace(/\s+/g, " ").trim();
}

function parseMetadata(lines) {
  const header = lines.find(line => line.startsWith("HEADER")) || "";
  const compound = pdbRecord(lines, "COMPND", 10).replace(/\bMOL_ID:\s*\d+;?/gi, "").replace(/\bMOLECULE:\s*/gi, "").replace(/;/g, "; ").trim();
  const organism = pdbRecord(lines, "SOURCE", 10).match(/ORGANISM_SCIENTIFIC:\s*([^;]+)/i)?.[1]?.trim() || "";
  return {
    classification: header.slice(10, 50).trim(),
    pdbId: header.slice(62, 66).trim(),
    title: pdbRecord(lines, "TITLE ", 10),
    compound,
    organism,
    keywords: pdbRecord(lines, "KEYWDS", 10),
  };
}

function cleanCifValue(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "." || text === "?") return "";
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) return text.slice(1, -1);
  return text;
}

function cifScalar(text, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escaped}\\s+(.+)$`, "m"));
  return cleanCifValue(match?.[1] || "");
}

function tokenizeCifRow(line) {
  return line.match(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\S+/g)?.map(cleanCifValue) || [];
}

function parseMmcifAtoms(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  let columns = null;
  let dataStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== "loop_") continue;
    const candidate = [];
    let cursor = i + 1;
    while (cursor < lines.length && lines[cursor].trim().startsWith("_")) candidate.push(lines[cursor++].trim());
    if (candidate.includes("_atom_site.Cartn_x") && candidate.includes("_atom_site.Cartn_y") && candidate.includes("_atom_site.Cartn_z")) {
      columns = candidate;
      dataStart = cursor;
      break;
    }
  }
  if (!columns) throw new Error("No mmCIF atom_site coordinate loop was found");
  const index = name => columns.indexOf(name);
  const firstIndex = names => names.map(index).find(value => value >= 0) ?? -1;
  const field = (row, names) => {
    const position = firstIndex(names);
    return position >= 0 ? cleanCifValue(row[position]) : "";
  };
  const allAtoms = [];
  const pending = [];
  for (let cursor = dataStart; cursor < lines.length; cursor += 1) {
    const trimmed = lines[cursor].trim();
    if (!trimmed || trimmed.startsWith("#")) {
      if (allAtoms.length && !pending.length) break;
      continue;
    }
    if ((trimmed === "loop_" || trimmed.startsWith("_")) && !pending.length) break;
    pending.push(...tokenizeCifRow(lines[cursor]));
    while (pending.length >= columns.length) {
      const row = pending.splice(0, columns.length);
      const record = field(row, ["_atom_site.group_PDB"]) || "ATOM";
      const atom = {
        record, serial: Number(field(row, ["_atom_site.id"])),
        atom: field(row, ["_atom_site.auth_atom_id", "_atom_site.label_atom_id"]),
        alt: field(row, ["_atom_site.label_alt_id"]),
        residue: field(row, ["_atom_site.auth_comp_id", "_atom_site.label_comp_id"]),
        chain: field(row, ["_atom_site.auth_asym_id", "_atom_site.label_asym_id"]) || "∅",
        seq: Number(field(row, ["_atom_site.auth_seq_id", "_atom_site.label_seq_id"])),
        insertion: field(row, ["_atom_site.pdbx_PDB_ins_code"]),
        x: Number(field(row, ["_atom_site.Cartn_x"])), y: Number(field(row, ["_atom_site.Cartn_y"])), z: Number(field(row, ["_atom_site.Cartn_z"])),
        occupancy: Number(field(row, ["_atom_site.occupancy"])), b: Number(field(row, ["_atom_site.B_iso_or_equiv"])),
        element: field(row, ["_atom_site.type_symbol"]).toUpperCase(), model: Number(field(row, ["_atom_site.pdbx_PDB_model_num"])) || 1
      };
      if ([atom.x, atom.y, atom.z].every(Number.isFinite)) allAtoms.push(atom);
    }
  }
  const pdbId = cifScalar(text, "_entry.id").toUpperCase();
  const title = cifScalar(text, "_struct.title");
  const compound = cifScalar(text, "_entity.pdbx_description");
  const organism = cifScalar(text, "_entity_src_gen.pdbx_gene_src_scientific_name") || cifScalar(text, "_entity_src_nat.pdbx_organism_scientific");
  const classification = cifScalar(text, "_struct_keywords.pdbx_keywords");
  const keywords = cifScalar(text, "_struct_keywords.text");
  return { allAtoms, metadata:{ pdbId, title, compound, organism, classification, keywords }, models: Math.max(...allAtoms.map(atom => atom.model || 1), 1), format:"mmCIF" };
}

function computeBetweenness(cas, adjacency) {
  const values = new Map(cas.map(residue => [residue.key, 0]));
  if (cas.length > 900) return { values, calculated:false };
  cas.forEach(source => {
    const stack = [];
    const predecessors = new Map(cas.map(residue => [residue.key, []]));
    const paths = new Map(cas.map(residue => [residue.key, 0]));
    const depth = new Map(cas.map(residue => [residue.key, -1]));
    paths.set(source.key, 1); depth.set(source.key, 0);
    const queue = [source.key];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor]; stack.push(node);
      adjacency.get(node).forEach(neighbor => {
        if (depth.get(neighbor) < 0) { queue.push(neighbor); depth.set(neighbor, depth.get(node) + 1); }
        if (depth.get(neighbor) === depth.get(node) + 1) {
          paths.set(neighbor, paths.get(neighbor) + paths.get(node));
          predecessors.get(neighbor).push(node);
        }
      });
    }
    const dependency = new Map(cas.map(residue => [residue.key, 0]));
    while (stack.length) {
      const node = stack.pop();
      predecessors.get(node).forEach(predecessor => {
        const denominator = paths.get(node) || 1;
        dependency.set(predecessor, dependency.get(predecessor) + (paths.get(predecessor) / denominator) * (1 + dependency.get(node)));
      });
      if (node !== source.key) values.set(node, values.get(node) + dependency.get(node));
    }
  });
  values.forEach((value, key) => values.set(key, value / 2));
  return { values, calculated:true };
}

function scoreResidues(metrics, lensName = "general") {
  const lens = scoreLenses[lensName] || scoreLenses.general;
  const maxima = {};
  ["degree","weighted","longRange","interchain","closeness","betweenness"].forEach(feature => { maxima[feature] = Math.max(...metrics.map(row => row[feature] || 0), 1e-12); });
  const ranked = metrics.map(row => {
    const normalized = {
      degree:(row.degree || 0) / maxima.degree, weighted:(row.weighted || 0) / maxima.weighted,
      longRange:(row.longRange || 0) / maxima.longRange, interchain:(row.interchain || 0) / maxima.interchain,
      closeness:(row.closeness || 0) / maxima.closeness, betweenness:(row.betweenness || 0) / maxima.betweenness,
      burial:row.burial || 0, ligand:row.ligandDistance === null ? 0 : Math.max(0, 1 - row.ligandDistance / 10), coordination:row.directMetalCoordination ? 1 : 0, cdr:row.cdrHeuristic ? 1 : 0
    };
    const contributions = Object.fromEntries(Object.entries(lens.weights).map(([feature, weight]) => [feature, 100 * weight * (normalized[feature] || 0)]));
    const score = Object.values(contributions).reduce((sum, value) => sum + value, 0);
    const signals = [];
    if (row.directMetalCoordination) signals.push(`${row.ligandDistance.toFixed(1)} Å direct ${row.nearestLigandElement} coordination in ${row.nearestLigand}`);
    else if (row.ligandDistance !== null && row.ligandDistance <= 6) signals.push(`${row.ligandDistance.toFixed(1)} Å from ${row.nearestLigand || "a bound group"}`);
    if (row.interchain) signals.push(`${row.interchain} cross-chain contact${row.interchain === 1 ? "" : "s"}`);
    if (row.longRange) signals.push(`${row.longRange} long-range contact${row.longRange === 1 ? "" : "s"}`);
    if (row.betweenness > 0) signals.push("shortest-path participation");
    if (row.cdrHeuristic) signals.push("antibody CDR-range heuristic");
    if (row.disulfidePartner) signals.push(`probable disulfide to ${row.disulfidePartner.label} (${row.disulfidePartner.distance.toFixed(2)} Å; no score bonus)`);
    if (row.burial >= .58) signals.push("buried structural context");
    if (!signals.length) signals.push("strongest available contact context");
    return { ...row, normalized, contributions, score, context:signals[0], rationale:`${row.degree} non-local contacts; ${signals.join("; ")}.` };
  }).sort((a,b) => b.score - a.score || b.degree - a.degree || a.label.localeCompare(b.label));
  ranked.forEach((row, index) => { row.rank = index + 1; row.percentile = ranked.length > 1 ? 100 * (ranked.length - index - 1) / (ranked.length - 1) : 100; });
  return ranked;
}

function pickMatchedControl(ranked, candidate) {
  if (!candidate) return null;
  const pool = ranked.slice(Math.min(10, ranked.length), Math.max(11, Math.ceil(ranked.length * .9))).filter(row => row.label !== candidate.label);
  const penalty = row => {
    const chemistry = row.residueClass === candidate.residueClass ? 0 : 2;
    const burial = 2 * Math.abs(row.burial - candidate.burial);
    const quality = Math.min(1, Math.abs((row.bMean || 0) - (candidate.bMean || 0)) / 40);
    const chain = row.chain === candidate.chain ? 0 : .35;
    const residualSignal = row.score / 100;
    return chemistry + burial + quality + chain + residualSignal;
  };
  const control = [...pool].sort((a,b) => penalty(a) - penalty(b))[0] || ranked.at(-1) || null;
  if (!control) return null;
  const quality = Math.max(0, Math.min(100, 100 - 24 * penalty(control)));
  return { ...control, matchQuality:quality, controlRationale:`Matched on ${control.residueClass === candidate.residueClass ? "residue chemistry" : "nearest available chemistry"}, burial (${control.burial.toFixed(2)} vs ${candidate.burial.toFixed(2)}), B field and ${control.chain === candidate.chain ? "chain context" : "available chain context"}; deliberately lower network score (${control.score.toFixed(1)} vs ${candidate.score.toFixed(1)}).` };
}

function rerankReport(report, lensName = activeScoringLens) {
  report.scoringLens = lensName;
  report.scoreWeights = { ...scoreLenses[lensName].weights };
  report.allResidues = scoreResidues(report.residueMetrics, lensName);
  report.topResidues = report.allResidues.slice(0, 10);
  report.controlResidue = pickMatchedControl(report.allResidues, report.topResidues[0]);
  return report;
}

function buildReportFromAtoms({ allAtoms, metadata, models = 1, format = "PDB", contactCutoff = 8 }) {
  const alternateCount = allAtoms.filter(atom => atom.alt && atom.alt !== "A").length;
  const atoms = allAtoms.filter(atom => !atom.alt || atom.alt === "A");
  const polymerAtoms = atoms.filter(atom => atom.record === "ATOM");
  if (!polymerAtoms.length) throw new Error("No polymer ATOM records were found");
  const residueMap = new Map();
  polymerAtoms.forEach(atom => {
    const key = `${atom.chain}:${atom.seq}:${atom.insertion}:${atom.residue}`;
    if (!residueMap.has(key)) residueMap.set(key, { key, chain:atom.chain, seq:atom.seq, insertion:atom.insertion, name:atom.residue, atoms:[], ca:null });
    const residue = residueMap.get(key); residue.atoms.push(atom); if (atom.atom === "CA") residue.ca = atom;
  });
  const residues = [...residueMap.values()];
  const chains = new Map();
  residues.forEach(residue => { if (!chains.has(residue.chain)) chains.set(residue.chain, []); chains.get(residue.chain).push(residue); });
  chains.forEach(items => items.sort((a,b) => a.seq - b.seq || a.insertion.localeCompare(b.insertion)).forEach((residue,index) => { residue.sequenceIndex = index + 1; }));
  const antibodyContext = /antibody|immunoglobulin|fab\b|nanobody|variable domain/i.test(Object.values(metadata || {}).join(" "));
  const antibodyChains = new Set();
  if (antibodyContext) chains.forEach((items, chain) => {
    const sequence = items.map(item => aminoAcidOneLetter[item.name] || "X").join("");
    const motifLike = items.length >= 85 && items.length <= 260 && /C.{7,22}[WFY].{35,85}C/.test(sequence);
    if (motifLike || chains.size <= 3) antibodyChains.add(chain);
  });
  const cdrRanges = [[24,35],[50,65],[89,102]];
  residues.forEach(residue => { residue.cdrHeuristic = antibodyChains.has(residue.chain) && cdrRanges.some(([start,end]) => residue.sequenceIndex >= start && residue.sequenceIndex <= end); });
  const disulfidePartners = new Map();
  const cysteines = residues.map(residue => ({ residue, sulfur:residue.atoms.find(atom => atom.atom === "SG") })).filter(item => item.residue.name === "CYS" && item.sulfur);
  for (let i=0;i<cysteines.length;i+=1) for (let j=i+1;j<cysteines.length;j+=1) {
    const separation = distance(cysteines[i].sulfur,cysteines[j].sulfur);
    if (separation >= 1.7 && separation <= 2.3) {
      const label = item => `CYS ${item.residue.chain}:${item.residue.seq}${item.residue.insertion}`;
      disulfidePartners.set(cysteines[i].residue.key,{ label:label(cysteines[j]), distance:separation });
      disulfidePartners.set(cysteines[j].residue.key,{ label:label(cysteines[i]), distance:separation });
    }
  }
  const degree = new Map(residues.map(row => [row.key,0]));
  const weighted = new Map(residues.map(row => [row.key,0]));
  const longRange = new Map(residues.map(row => [row.key,0]));
  const interchain = new Map(residues.map(row => [row.key,0]));
  const adjacency = new Map(residues.map(row => [row.key,new Set()]));
  const cas = residues.filter(row => row.ca);
  const edges = [];
  const spatialCells = new Map();
  const cellKey = (x,y,z) => `${x},${y},${z}`;
  cas.forEach(a => {
    const cell = [Math.floor(a.ca.x/contactCutoff),Math.floor(a.ca.y/contactCutoff),Math.floor(a.ca.z/contactCutoff)];
    for (let dx=-1;dx<=1;dx+=1) for (let dy=-1;dy<=1;dy+=1) for (let dz=-1;dz<=1;dz+=1) {
      (spatialCells.get(cellKey(cell[0]+dx,cell[1]+dy,cell[2]+dz)) || []).forEach(b => {
        if (a.chain === b.chain && Math.abs(a.sequenceIndex-b.sequenceIndex) <= 2) return;
        const separation=distance(a.ca,b.ca);
        if (separation > contactCutoff) return;
        edges.push({ source:a.key, target:b.key, distance:separation });
        degree.set(a.key,degree.get(a.key)+1); degree.set(b.key,degree.get(b.key)+1);
        adjacency.get(a.key).add(b.key); adjacency.get(b.key).add(a.key);
        weighted.set(a.key,weighted.get(a.key)+(contactCutoff-separation)/contactCutoff); weighted.set(b.key,weighted.get(b.key)+(contactCutoff-separation)/contactCutoff);
        if (a.chain !== b.chain) { interchain.set(a.key,interchain.get(a.key)+1); interchain.set(b.key,interchain.get(b.key)+1); }
        else if (Math.abs(a.sequenceIndex-b.sequenceIndex) >= 12) { longRange.set(a.key,longRange.get(a.key)+1); longRange.set(b.key,longRange.get(b.key)+1); }
      });
    }
    const ownKey=cellKey(...cell);
    if (!spatialCells.has(ownKey)) spatialCells.set(ownKey,[]);
    spatialCells.get(ownKey).push(a);
  });
  const closeness = new Map(residues.map(row => [row.key,0]));
  if (cas.length <= 1500) cas.forEach(start => {
    const distances=new Map([[start.key,0]]), queue=[start.key];
    for (let cursor=0;cursor<queue.length;cursor+=1) adjacency.get(queue[cursor]).forEach(neighbor => { if (!distances.has(neighbor)) { distances.set(neighbor,distances.get(queue[cursor])+1); queue.push(neighbor); } });
    const total=[...distances.values()].reduce((sum,value)=>sum+value,0);
    closeness.set(start.key,total>0?(distances.size-1)/total:0);
  });
  const betweennessResult = computeBetweenness(cas, adjacency);
  const chainReports = [...chains.entries()].map(([chain,items]) => {
    let breaks=0;
    for (let i=1;i<items.length;i+=1) if (items[i].seq-items[i-1].seq>1 || (items[i].ca && items[i-1].ca && distance(items[i].ca,items[i-1].ca)>4.5)) breaks+=1;
    return { chain, residues:items.length, atoms:items.reduce((sum,row)=>sum+row.atoms.length,0), start:items[0]?.seq, end:items.at(-1)?.seq, breaks, sequence:items.map(item=>aminoAcidOneLetter[item.name]||"X").join("") };
  });
  const hetero=new Map(), waters=[];
  const heteroAtoms=atoms.filter(atom => atom.record === "HETATM" && !waterNames.has(atom.residue));
  atoms.filter(atom => atom.record === "HETATM").forEach(atom => {
    if (waterNames.has(atom.residue)) return waters.push(atom);
    const key=`${atom.residue}:${atom.chain}:${atom.seq}`;
    if (!hetero.has(key)) hetero.set(key,{ name:atom.residue,chain:atom.chain,seq:atom.seq,elements:new Set() });
    hetero.get(key).elements.add(atom.element);
  });
  const metals=[...hetero.values()].filter(group => [...group.elements].some(element=>metalElements.has(element)));
  const bValues=polymerAtoms.map(atom=>atom.b).filter(Number.isFinite);
  const lowOccupancy=polymerAtoms.filter(atom=>Number.isFinite(atom.occupancy)&&atom.occupancy<.999).length;
  const missingCa=residues.filter(row=>!row.ca).length;
  const centroid=cas.reduce((sum,row)=>({x:sum.x+row.ca.x/Math.max(cas.length,1),y:sum.y+row.ca.y/Math.max(cas.length,1),z:sum.z+row.ca.z/Math.max(cas.length,1)}),{x:0,y:0,z:0});
  const maxRadius=Math.max(...cas.map(row=>distance(row.ca,centroid)),1);
  const residueMetrics=residues.filter(row=>row.ca).map(row => {
    const nearestLigandAtom=row.atoms.slice(0,16).reduce((residueBest,residueAtom)=>heteroAtoms.slice(0,2000).reduce((best,atom)=>{const separation=distance(residueAtom,atom);return !best||separation<best.distance?{atom,distance:separation}:best;},residueBest),null);
    return {
      key:row.key,label:`${row.name} ${row.chain}:${row.seq}${row.insertion}`,name:row.name,chain:row.chain,seq:row.seq,insertion:row.insertion,sequenceIndex:row.sequenceIndex,
      degree:degree.get(row.key),weighted:weighted.get(row.key),longRange:longRange.get(row.key),interchain:interchain.get(row.key),closeness:closeness.get(row.key),betweenness:betweennessResult.values.get(row.key)||0,
      burial:1-Math.min(1,distance(row.ca,centroid)/maxRadius),ligandDistance:nearestLigandAtom?.distance??null,nearestLigand:nearestLigandAtom?.atom?.residue??null,nearestLigandElement:nearestLigandAtom?.atom?.element??null,directMetalCoordination:Boolean(nearestLigandAtom&&metalElements.has(nearestLigandAtom.atom.element)&&nearestLigandAtom.distance<=3.0),
      bMean:row.atoms.length?row.atoms.reduce((sum,atom)=>sum+(Number.isFinite(atom.b)?atom.b:0),0)/row.atoms.length:null,residueClass:residueClass(row.name),disulfidePartner:disulfidePartners.get(row.key)||null,cdrHeuristic:row.cdrHeuristic,ca:{x:row.ca.x,y:row.ca.y,z:row.ca.z}
    };
  });
  const report={ residues:residues.length,polymerAtoms:polymerAtoms.length,chainReports,contacts:edges.length,alternateCount,lowOccupancy,missingCa,disulfides:Math.floor(disulfidePartners.size/2),waters:waters.length,
    hetero:[...hetero.values()].map(group=>`${group.name} ${group.chain}:${group.seq}`),metals:metals.map(group=>`${group.name} ${group.chain}:${group.seq}`),bMean:bValues.length?bValues.reduce((sum,value)=>sum+value,0)/bValues.length:null,bMedian:median(bValues),
    residueMetrics,edges,models,metadata,format,contactCutoff,betweennessCalculated:betweennessResult.calculated,antibodyContext,antibodyChains:[...antibodyChains]
  };
  return rerankReport(report,activeScoringLens);
}

function parseCoordinateFile(text, sourceName = "", options = {}) {
  if (/^\s*data_/i.test(text) || /\.cif$/i.test(sourceName) || /\.mmcif$/i.test(sourceName)) return buildReportFromAtoms({ ...parseMmcifAtoms(text), contactCutoff:options.contactCutoff || 8 });
  return parsePdb(text, options);
}

function biologicalGuidance(report, candidateOverride = report.topResidues[0], controlOverride = null) {
  const metadata = report.metadata || {};
  const candidate = candidateOverride;
  const control = controlOverride || pickMatchedControl(report.allResidues, candidate) || report.controlResidue;
  const mutation = mutationLadder(candidate).conservative;
  const proteinLabel = metadata.compound || metadata.title || metadata.classification || "Supplied protein structure";
  const context = [metadata.title, metadata.compound, metadata.classification, metadata.keywords, report.hetero.join(" ")].join(" ").toLowerCase();
  const ligandNames = [...new Set(report.hetero.map(item => item.split(" ")[0]))];
  const assembly = report.chainReports.length > 1 ? `${report.chainReports.length}-chain assembly` : "single-chain structure";
  const ligandContext = ligandNames.length ? ` with ${ligandNames.slice(0, 3).join(", ")}` : "";
  const categories = [
    {
      match: /hemoglobin|haemoglobin|oxygen transport|oxygen-binding|heme transport/,
      identity: "Oxygen-carrying heme assembly",
      useCase: "Oxygen binding and cooperativity",
      useNote: "Useful for testing heme-linked function, subunit communication, oxygen affinity and assembly stability.",
      assay: "an oxygen-equilibrium or spectral heme assay",
      purpose: "The structure is suited to separating heme-proximal effects from subunit communication and general fold loss.",
    },
    {
      match: /antibody|immunoglobulin|immune|antigen/,
      identity: "Immune recognition protein",
      useCase: "Binding and specificity",
      useNote: "Useful for testing whether a surface site changes recognition without destabilizing the scaffold.",
      assay: "the established binding or neutralization assay",
      purpose: "The most useful question is whether a surface intervention changes recognition beyond a matched structural perturbation.",
    },
    {
      match: /receptor|signaling|signal transduction|g-protein|kinase|phosphatase/,
      identity: "Signaling protein",
      useCase: "Activity and state control",
      useNote: "Useful for prioritizing sites that may change activity, partner response or conformational state.",
      assay: "the closest established activity or signaling readout",
      purpose: "The structure can identify a perturbation that tests state or partner control while preserving molecular integrity.",
    },
    {
      match: /enzyme|oxidoreductase|transferase|hydrolase|lyase|isomerase|ligase|protease|catalytic|\w+ase\b/,
      identity: "Catalytic protein",
      useCase: "Catalysis and substrate handling",
      useNote: "Useful for separating catalytic, ligand-positioning and structural effects.",
      assay: "a substrate-turnover or product-formation assay",
      purpose: "The structure is useful for testing whether a graph-prioritized site changes catalysis rather than simply reducing fold quality.",
    },
    {
      match: /transporter|transport protein|channel|porin|membrane protein/,
      identity: "Transport or channel protein",
      useCase: "Transport and gating",
      useNote: "Useful for testing whether a site changes transport, gating or assembly while membrane expression remains intact.",
      assay: "the established flux, uptake or electrophysiology readout",
      purpose: "The structure can separate a gating or transport hypothesis from expression and assembly failure.",
    },
    {
      match: /dna binding|rna binding|ribosomal|transcription|nucleic acid/,
      identity: "Nucleic-acid-associated protein",
      useCase: "Recognition and regulation",
      useNote: "Useful for testing binding, assembly or regulatory effects against a fold-preserving comparison.",
      assay: "the established nucleic-acid binding or regulatory assay",
      purpose: "The structure is suited to testing whether a prioritized site changes recognition beyond general structural disruption.",
    },
  ];
  const category = categories.find(item => item.match.test(context)) || {
    identity: metadata.classification ? metadata.classification.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) : "Structured protein target",
    useCase: ligandNames.length ? "Ligand response and structure-function tests" : "Structure-function experiments",
    useNote: ligandNames.length ? `Useful for comparing ligand-linked sites with lower-contact structural controls.` : "Useful for choosing an interpretable first perturbation and a fair structural comparison.",
    assay: "the protein's closest established biological readout",
    purpose: "The coordinate model supports a controlled structure-function test. Protein-specific use should be confirmed from the supplied annotation and laboratory context.",
  };
  const identityNote = `${proteinLabel}${metadata.organism ? ` · ${metadata.organism}` : ""}. ${assembly}${ligandContext}.`;
  const siteReason = candidate?.directMetalCoordination
    ? `${candidate.label} makes a ${candidate.ligandDistance.toFixed(1)} Å direct contact to ${candidate.nearestLigandElement} in ${candidate.nearestLigand}; this is explicit coordinate evidence for a metal-linked structural role, not a prediction of the mutation outcome.`
    : candidate?.interchain
    ? `${candidate.label} sits at a cross-chain structural junction and is positioned to test communication within the assembly.`
    : candidate?.ligandDistance !== null && candidate?.ligandDistance <= 6
      ? `${candidate.label} is ${candidate.ligandDistance.toFixed(1)} Å from ${candidate.nearestLigand || "a bound group"} and can test whether that local ligand contact matters.`
      : candidate?.disulfidePartner
        ? `${candidate.label} participates in a probable disulfide constraint, making structural integrity the first biological question.`
        : `${candidate?.label || "The first site"} has unusually broad reach through the residue contact graph and offers the clearest first contrast in this structure.`;
  return {
    ...category,
    identityNote,
    siteReason,
    firstMove: `${mutation} at ${candidate?.label || "the first ranked site"}`,
    experiment: `Build ${mutation} and the equivalent perturbation at ${control?.label || "a matched lower-contact site"}. Run both beside wild type. Measure ${category.assay}, then abundance and one folding or stability readout in the same batch.`,
  };
}

function parsePdb(text, options = {}) {
  const lines = text.replace(/\r/g, "").split("\n");
  const metadata = parseMetadata(lines);
  const atomLines = lines.filter(line => line.startsWith("ATOM  ") || line.startsWith("HETATM"));
  if (!atomLines.length) throw new Error("No ATOM or HETATM coordinate records were found");
  const allAtoms = atomLines.map(parseAtom).filter(a => [a.x, a.y, a.z].every(Number.isFinite));
  return buildReportFromAtoms({ allAtoms, metadata, models:lines.filter(line => line.startsWith("MODEL ")).length || 1, format:"PDB", contactCutoff:options.contactCutoff || 8 });
  /* Legacy implementation retained below for release-diff traceability; execution returns through the shared parser above. */
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
  const disulfidePartners = new Map();
  const cysteines = residues.map(residue => ({ residue, sulfur: residue.atoms.find(atom => atom.atom === "SG") })).filter(item => item.residue.name === "CYS" && item.sulfur);
  for (let i = 0; i < cysteines.length; i += 1) for (let j = i + 1; j < cysteines.length; j += 1) {
    const separation = distance(cysteines[i].sulfur, cysteines[j].sulfur);
    if (separation >= 1.7 && separation <= 2.3) {
      const label = item => `CYS ${item.residue.chain}:${item.residue.seq}${item.residue.insertion}`;
      disulfidePartners.set(cysteines[i].residue.key, { label: label(cysteines[j]), distance: separation });
      disulfidePartners.set(cysteines[j].residue.key, { label: label(cysteines[i]), distance: separation });
    }
  }
  const chains = new Map();
  residues.forEach(residue => { if (!chains.has(residue.chain)) chains.set(residue.chain, []); chains.get(residue.chain).push(residue); });
  const degree = new Map(residues.map(r => [r.key, 0]));
  const weighted = new Map(residues.map(r => [r.key, 0]));
  const longRange = new Map(residues.map(r => [r.key, 0]));
  const interchain = new Map(residues.map(r => [r.key, 0]));
  const adjacency = new Map(residues.map(r => [r.key, new Set()]));
  const cas = residues.filter(r => r.ca);
  let contacts = 0;
  for (let i = 0; i < cas.length; i += 1) for (let j = i + 1; j < cas.length; j += 1) {
    const a = cas[i], b = cas[j];
    if (a.chain === b.chain && Math.abs(a.seq - b.seq) <= 2) continue;
    const separation = distance(a.ca, b.ca);
    if (separation <= 8.0) {
      contacts += 1;
      degree.set(a.key, degree.get(a.key) + 1); degree.set(b.key, degree.get(b.key) + 1);
      adjacency.get(a.key).add(b.key); adjacency.get(b.key).add(a.key);
      weighted.set(a.key, weighted.get(a.key) + (8.0 - separation) / 8.0); weighted.set(b.key, weighted.get(b.key) + (8.0 - separation) / 8.0);
      if (a.chain !== b.chain) { interchain.set(a.key, interchain.get(a.key) + 1); interchain.set(b.key, interchain.get(b.key) + 1); }
      else if (Math.abs(a.seq - b.seq) >= 12) { longRange.set(a.key, longRange.get(a.key) + 1); longRange.set(b.key, longRange.get(b.key) + 1); }
    }
  }
  const closeness = new Map(residues.map(r => [r.key, 0]));
  if (cas.length <= 1500) {
    cas.forEach(start => {
      const distances = new Map([[start.key, 0]]);
      const queue = [start.key];
      for (let index = 0; index < queue.length; index += 1) {
        const node = queue[index];
        adjacency.get(node).forEach(neighbor => {
          if (distances.has(neighbor)) return;
          distances.set(neighbor, distances.get(node) + 1);
          queue.push(neighbor);
        });
      }
      const total = [...distances.values()].reduce((sum, value) => sum + value, 0);
      closeness.set(start.key, total > 0 ? (distances.size - 1) / total : 0);
    });
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
  const heteroAtoms = atoms.filter(a => a.record === "HETATM" && !waterNames.has(a.residue));
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
  const centroid = cas.reduce((sum, residue) => ({ x: sum.x + residue.ca.x / Math.max(cas.length, 1), y: sum.y + residue.ca.y / Math.max(cas.length, 1), z: sum.z + residue.ca.z / Math.max(cas.length, 1) }), { x: 0, y: 0, z: 0 });
  const radial = cas.map(residue => distance(residue.ca, centroid));
  const maxRadius = Math.max(...radial, 1);
  const rawResidues = residues.filter(r => r.ca).map(r => {
    const nearestLigandAtom = r.atoms.slice(0, 16).reduce((residueBest, residueAtom) => heteroAtoms.slice(0, 1500).reduce((best, atom) => {
      const separation = distance(residueAtom, atom);
      return !best || separation < best.distance ? { atom, distance: separation } : best;
    }, residueBest), null);
    const ligandDistance = nearestLigandAtom?.distance ?? null;
    const nearestLigand = nearestLigandAtom?.atom?.residue ?? null;
    const bMean = r.atoms.length ? r.atoms.reduce((sum, atom) => sum + (Number.isFinite(atom.b) ? atom.b : 0), 0) / r.atoms.length : null;
    return {
      label: `${r.name} ${r.chain}:${r.seq}${r.insertion}`, name: r.name, chain: r.chain, seq: r.seq, insertion: r.insertion,
      degree: degree.get(r.key), weighted: weighted.get(r.key), longRange: longRange.get(r.key), interchain: interchain.get(r.key), closeness: closeness.get(r.key),
      burial: 1 - Math.min(1, distance(r.ca, centroid) / maxRadius), ligandDistance, nearestLigand, bMean, residueClass: residueClass(r.name), disulfidePartner: disulfidePartners.get(r.key) || null
    };
  });
  const maxima = {
    degree: Math.max(...rawResidues.map(r => r.degree), 1), weighted: Math.max(...rawResidues.map(r => r.weighted), 1),
    longRange: Math.max(...rawResidues.map(r => r.longRange), 1), interchain: Math.max(...rawResidues.map(r => r.interchain), 1), closeness: Math.max(...rawResidues.map(r => r.closeness), 1)
  };
  const rankedResidues = rawResidues.map(r => {
    const ligandSignal = r.ligandDistance === null ? 0 : Math.max(0, 1 - r.ligandDistance / 10);
    const score = Math.min(100, 100 * (.22 * r.degree / maxima.degree + .10 * r.weighted / maxima.weighted + .10 * r.longRange / maxima.longRange + .13 * r.interchain / maxima.interchain + .10 * r.closeness / maxima.closeness + .06 * r.burial + .23 * ligandSignal + (r.disulfidePartner ? .06 : 0)));
    const signals = [];
    if (r.disulfidePartner) signals.push(`probable disulfide to ${r.disulfidePartner.label} (${r.disulfidePartner.distance.toFixed(2)} Å)`);
    if (r.interchain) signals.push(`${r.interchain} cross-chain contact${r.interchain === 1 ? "" : "s"}`);
    if (r.longRange) signals.push(`${r.longRange} long-range contact${r.longRange === 1 ? "" : "s"}`);
    if (r.ligandDistance !== null && r.ligandDistance <= 6) signals.push(`${r.ligandDistance.toFixed(1)} Å from ${r.nearestLigand || "a bound group"}`);
    if (r.burial >= .58) signals.push("buried structural context");
    if (!signals.length) signals.push("strongest available local contact context");
    return { ...r, score, context: signals[0], rationale: `${r.degree} non-local contacts; ${signals.join("; ")}.` };
  }).sort((a,b) => b.score - a.score || b.degree - a.degree || a.label.localeCompare(b.label));
  const nuisanceLigands = new Set(["PO4", "SO4", "GOL", "EDO", "PEG", "ACT", "FMT", "TRS", "MES", "HEP", "CL", "NA"]);
  const ligandAnchored = rankedResidues.filter(r => r.nearestLigand && !nuisanceLigands.has(r.nearestLigand) && r.ligandDistance <= 3.5).sort((a, b) => {
    const chemistryPriority = row => row.nearestLigand === "HEM" && row.name === "HIS" ? 0 : 1;
    return chemistryPriority(a) - chemistryPriority(b) || b.score - a.score || a.ligandDistance - b.ligandDistance;
  });
  const orderedResidues = ligandAnchored.length ? [ligandAnchored[0], ...rankedResidues.filter(r => r !== ligandAnchored[0])] : rankedResidues;
  const topResidues = orderedResidues.slice(0, 5);
  const candidate = orderedResidues[0];
  const controlPool = rankedResidues.slice(Math.min(5, rankedResidues.length), Math.max(6, Math.ceil(rankedResidues.length * .85))).filter(row => row !== candidate);
  const controlResidue = controlPool.sort((a, b) => {
    const penalty = row => (row.residueClass === candidate?.residueClass ? 0 : 1.5) + Math.abs(row.burial - (candidate?.burial || 0)) + row.score / 100;
    return penalty(a) - penalty(b);
  })[0] || rankedResidues.at(-1) || null;
  return {
    residues: residues.length, polymerAtoms: polymerAtoms.length, chainReports, contacts, alternateCount, lowOccupancy, missingCa, disulfides: Math.floor(disulfidePartners.size / 2),
    waters: waters.length, hetero: [...hetero.values()].map(group => `${group.name} ${group.chain}:${group.seq}`), metals: metals.map(group => `${group.name} ${group.chain}:${group.seq}`),
    bMean: bValues.length ? bValues.reduce((sum,v) => sum+v,0)/bValues.length : null, bMedian: median(bValues), topResidues, allResidues: rankedResidues, controlResidue,
    models: lines.filter(line => line.startsWith("MODEL ")).length || 1, metadata
  };
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function analyze(text, sourceName, sourceType) {
  setStatus(`Analyzing ${sourceName} locally…`);
  try {
    const report = parseCoordinateFile(text, sourceName);
    const digest = await sha256(text);
    const receiptId = `RNB-${digest.slice(0, 12).toUpperCase()}`;
    current = { sourceName, sourceType, digest, receiptId, report, rawText: text, analyzedAt: new Date().toISOString() };
    render(current);
    fetchPublicBiology(report);
    setStatus(`Complete. ${sourceName} was parsed locally; no coordinates were sent to RINet.`);
  } catch (error) {
    console.error("RINet analysis failed", error);
    setStatus(`Analysis stopped: ${error.message}. Confirm that this is a fixed-column PDB file.`, true);
  }
}

function buildDiscoveryPrograms(report) {
  const biology = biologicalGuidance(report);
  const candidate = report.topResidues[0];
  const control = report.controlResidue;
  const candidateLabel = candidate?.label || "the first ranked site";
  const controlLabel = control?.label || "a matched lower-contact site";
  const firstChange = mutationLadder(candidate).conservative;
  const isOxygenAssembly = /oxygen|hemoglobin|haemoglobin|heme assembly/i.test(`${biology.identity} ${biology.useCase} ${report.metadata?.title || ""} ${report.metadata?.compound || ""}`);
  const generic = {
    biology: {
      title: "Structure–function test",
      thesis: `Compare ${candidateLabel} with ${controlLabel} using a protein-specific functional readout.`,
      opportunity: `Test whether the mutation at ${candidateLabel} produces a larger functional effect than the matched lower-score residue ${controlLabel}.`,
      program: `Test ${firstChange}, a matched perturbation at ${controlLabel}, and wild type. Measure integrity first, then ${biology.assay}.`,
      question: `Does the candidate change the protein-specific output more than structural background while molecular integrity remains intact?`
    },
    engineering: {
      title: "Protein engineering screen",
      thesis: `Test a graded mutation series at ${candidateLabel} and remove constructs that lose expression or fold.`,
      opportunity: `Compare conservative, neutralizing and stronger mutations at ${candidateLabel}, using ${controlLabel} as the structural control.`,
      program: `Build a three-step chemistry ladder at ${candidateLabel}. Screen abundance and folding, then advance only intact constructs into ${biology.assay}.`,
      question: "Can the response be shifted in a graded way without losing expression, assembly or fold quality?"
    },
    translation: {
      title: "Variant classification",
      thesis: "Classify each effect as functional, expression-related, folding-related, or unresolved.",
      opportunity: `Use the candidate and matched control to classify a variant by function, abundance and fold rather than by one score.`,
      program: `Measure abundance, one orthogonal integrity readout and ${biology.assay} in the same batch. Keep conclusions at the protein level unless clinical evidence is supplied.`,
      question: "Which measurement cleanly distinguishes a functional effect from reduced expression, misfolding or failed assembly?"
    },
    mechanism: {
      title: "Mechanism test",
      thesis: `Use ${candidateLabel} to distinguish local packing, ligand coupling, assembly effects and site-specific functional control.`,
      opportunity: `Compare ${candidateLabel}, ${controlLabel} and the next ranked site across a shared integrity and function panel.`,
      program: `Predefine predictions for local packing, fold loss and site-specific function. Use ${biology.assay} only after the integrity gate passes.`,
      question: "Which single outcome would force the leading structural explanation to be abandoned?"
    }
  };
  if (!isOxygenAssembly) return generic;
  return {
    biology: {
      title: "Hemoglobin structure–function test",
      thesis: "Compare heme-proximal, interface and lower-score control residues in the same preparation.",
      opportunity: "Measure which interventions preserve heme occupancy but alter oxygen affinity or cooperativity. This separates oxygen handling from generic protein damage.",
      program: `Compare ${candidateLabel}, an interface-ranked site and ${controlLabel}. Measure heme spectra, oxygen equilibrium and tetramer integrity in the same preparation.`,
      question: "Does the candidate alter oxygen affinity or cooperativity while heme loading and tetramer integrity remain intact?"
    },
    engineering: {
      title: "Oxygen-affinity engineering screen",
      thesis: "Screen for a change in oxygen affinity or cooperativity without loss of heme loading or tetramer assembly.",
      opportunity: `Use ${candidateLabel} as the chemistry-linked anchor, then compare graded perturbations at a subunit interface and matched structural background.`,
      program: "Build a small perturbation ladder across heme-contact, interface and network sites. Measure heme occupancy, oxygen curves and oligomeric state before choosing a lead.",
      question: "Can an intervention shift oxygen response without altering heme loading or tetramer integrity?"
    },
    translation: {
      title: "Hemoglobin variant classification",
      thesis: "Classify a variant as affecting heme binding, oxygen response, assembly, fold, or none of these measured properties.",
      opportunity: "Classify oxygen-transport variants with a compact panel instead of treating every functional loss as the same mechanism.",
      program: "Measure abundance, heme occupancy, the oxygen equilibrium curve and oligomerization. Keep the output as molecular evidence, not medical advice.",
      question: "Which readout distinguishes altered oxygen behavior from heme loss, assembly failure or destabilization?"
    },
    mechanism: {
      title: "Heme–interface coupling test",
      thesis: "Compare a proximal-heme residue with a subunit-interface residue across deoxy and oxy states.",
      opportunity: `Use ${candidateLabel} and an interface site to compare local heme coupling with cross-subunit communication.`,
      program: "Compare deoxy and oxy structural states, identify contacts that change with state, then perturb one heme-linked and one interface-linked site with matched integrity controls.",
      question: "Which contact changes with oxygenation and produces a specific functional effect when perturbed?"
    }
  };
}

function discoveryGrounding(report) {
  const publicData = report.publicBiology;
  if (publicData) {
    const uniprot = publicData.uniprotIds.length ? ` · UniProt ${publicData.uniprotIds.join(" / ")}` : "";
    return `Verified annotation: RCSB PDB ${publicData.pdbId}${uniprot} · ${publicData.entityCount} polymer ${publicData.entityCount === 1 ? "entity" : "entities"}`;
  }
  const selected = molecular.selectedResidue ? ` · selected ${molecular.selectedResidue.label}` : "";
  return `Grounded in supplied PDB metadata, coordinates and deterministic residue graph${selected}.`;
}

function renderDiscovery(report, mode = activeDiscoveryMode) {
  activeDiscoveryMode = mode;
  const program = buildDiscoveryPrograms(report)[mode] || buildDiscoveryPrograms(report).biology;
  document.querySelectorAll("[data-discovery-mode]").forEach(button => {
    const active = button.dataset.discoveryMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("discoveryModeLabel").textContent = `${mode.toUpperCase()} MODE`;
  document.getElementById("discoveryTitle").textContent = program.title;
  document.getElementById("discoveryThesis").textContent = program.thesis;
  document.getElementById("discoveryOpportunity").textContent = program.opportunity;
  document.getElementById("discoveryProgram").textContent = program.program;
  document.getElementById("discoveryQuestion").textContent = program.question;
  document.getElementById("discoveryGrounding").textContent = discoveryGrounding(report);
}

async function fetchPublicBiology(report) {
  const pdbId = String(report.metadata?.pdbId || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(pdbId)) return;
  try {
    const entryResponse = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
    if (!entryResponse.ok) return;
    const entry = await entryResponse.json();
    const entityIds = entry.rcsb_entry_container_identifiers?.polymer_entity_ids || [];
    const entities = await Promise.all(entityIds.slice(0, 6).map(async entityId => {
      const response = await fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${pdbId}/${entityId}`);
      return response.ok ? response.json() : null;
    }));
    const validEntities = entities.filter(Boolean);
    const descriptions = [...new Set(validEntities.flatMap(entity => entity.rcsb_polymer_entity?.pdbx_description || []).filter(Boolean))];
    const uniprotIds = [...new Set(validEntities.flatMap(entity => {
      const identifiers = entity.rcsb_polymer_entity_container_identifiers || {};
      const direct = identifiers.uniprot_ids || [];
      const referenced = (identifiers.reference_sequence_identifiers || []).filter(item => item.database_name === "UniProt").map(item => item.database_accession);
      return [...direct, ...referenced];
    }).filter(Boolean))];
    report.publicBiology = { pdbId, entityCount: entityIds.length, descriptions, uniprotIds };
    if (current?.report === report) renderDiscovery(report, activeDiscoveryMode);
  } catch (_) {
    // Embedded metadata remains the grounded fallback if public annotation is unavailable.
  }
}

function renderGuidance(report, candidateOverride = report.topResidues[0]) {
  const candidate = candidateOverride;
  const runnerUp = report.topResidues.find(row => row.label !== candidate?.label);
  const control = pickMatchedControl(report.allResidues, candidate) || report.controlResidue;
  const breakCount = report.chainReports.reduce((sum, chain) => sum + chain.breaks, 0);
  const coverage = report.residues ? (report.residues - report.missingCa) / report.residues : 0;
  const occupancyPenalty = report.polymerAtoms ? Math.min(.12, report.lowOccupancy / report.polymerAtoms) : 0;
  const warningPenalty = Math.min(.28, breakCount * .035 + report.alternateCount / Math.max(report.polymerAtoms, 1) + occupancyPenalty);
  const completeness = Math.max(.45, Math.min(.99, coverage - warningPenalty));
  const mutation = mutationSuggestion(candidate);
  const ladder = mutationLadder(candidate);
  const candidateLabel = candidate?.label || "No ranked residue";
  const controlLabel = control?.label || "Choose a lower-contact residue";
  const contrast = runnerUp ? ` ${runnerUp.label} is the next site to examine if the first construct is inconclusive.` : "";
  const contactClass = candidate?.degree >= 8 ? "a highly connected structural hub" : candidate?.degree >= 4 ? "a moderately connected structural junction" : "the strongest available contact signal in this model";
  const disulfide = candidate?.disulfidePartner;
  const biology = biologicalGuidance(report, candidate, control);
  const structuralThesis = disulfide
    ? `${candidateLabel} forms a ${disulfide.distance.toFixed(2)} Å sulfur–sulfur contact with ${disulfide.label}, consistent with a disulfide constraint. The decisive question is whether function changes beyond any loss of structural integrity.`
    : `${candidateLabel} is the strongest multi-signal structural contrast in this coordinate model. Test it against ${controlLabel} while holding expression and folding accountable.`;

  document.getElementById("guidanceIdentity").textContent = biology.identity;
  document.getElementById("guidanceIdentityNote").textContent = biology.identityNote;
  document.getElementById("guidanceUseCase").textContent = biology.useCase;
  document.getElementById("guidanceUseCaseNote").textContent = biology.useNote;
  document.getElementById("guidancePrimaryReason").textContent = biology.siteReason;
  document.getElementById("guidanceMutation").textContent = biology.firstMove;
  document.getElementById("guidanceGate").textContent = disulfide ? "Integrity before function" : "Candidate must beat control";
  document.getElementById("guidanceConfidence").textContent = `${Math.round(completeness * 100)}% coordinate completeness, not biological certainty.`;
  document.getElementById("guidanceHypothesis").textContent = `${biology.purpose} ${biology.siteReason}${contrast}`;
  document.getElementById("guidanceExperiment").textContent = biology.experiment;
  document.getElementById("guidanceAdvance").textContent = `Advance the hypothesis if the ${candidateLabel} perturbation changes the biological readout more than ${controlLabel}, while expression and folding remain acceptably similar to wild type.`;
  document.getElementById("guidanceStop").textContent = `Do not interpret the site as specifically informative if candidate and comparison behave similarly, or if the candidate mainly lowers expression or disrupts folding. In that case, test ${runnerUp?.label || "the next-ranked residue"} or revise the assay.`;
  document.getElementById("mutationConservative").textContent = ladder.conservative;
  document.getElementById("mutationNeutral").textContent = ladder.neutral;
  document.getElementById("mutationStress").textContent = ladder.stress;
  document.getElementById("guidanceIntegrity").textContent = `For ${candidateLabel}, quantify expression or abundance and add one orthogonal folding/stability readout before interpreting function.`;
  document.getElementById("guidanceFunction").textContent = `Use ${biology.assay}; predefine the smallest effect that would be worth following.`;
  document.getElementById("guidanceSpecificity").textContent = `Run wild type, ${ladder.conservative}, ${ladder.neutral}, and the matched-site perturbation at ${controlLabel} together.`;
  document.getElementById("diagnosticAdvance").textContent = `${candidateLabel} becomes a stronger site-specific hypothesis if its functional effect exceeds ${controlLabel} without a comparable integrity defect.`;
  document.getElementById("diagnosticFold").textContent = `Do not call mechanism. Reduce perturbation severity, improve expression controls, or test ${ladder.conservative} first.`;
  document.getElementById("diagnosticControl").textContent = `The contact ranking has not separated ${candidateLabel} from structural background; deprioritize or redesign the contrast.`;
  document.getElementById("diagnosticNext").textContent = `Confirm assay sensitivity, then move to ${runnerUp?.label || "the next-ranked structural site"}.`;
  document.getElementById("alternatePacking").textContent = `${candidateLabel} may report local packing stress because it is ${contactClass}, rather than a specific functional pathway.`;
  document.getElementById("alternateExpression").textContent = `${ladder.neutral} may change abundance, folding or trafficking; those explanations must be measured before a site-specific interpretation.`;
  document.getElementById("alternateContext").textContent = `This static coordinate model may omit the assay-relevant state, ligand, partner or membrane context.`;
  document.getElementById("guidanceNext").textContent = runnerUp?.label || "No second site available";
  document.getElementById("viewerCandidate").textContent = candidateLabel;
  document.getElementById("viewerCandidateReason").textContent = candidate ? residueExplanation(candidate) : "NO RANKABLE CONTACT SIGNAL";
  document.getElementById("hudThesis").textContent = `${biology.identity}. ${biology.siteReason}`;
  document.getElementById("hudMutation").textContent = ladder.conservative;
  document.getElementById("hudMutationNote").textContent = disulfide ? "Disrupts the bridge; treat folding as the first readout." : `Tests ${candidateLabel} with the least severe informative change.`;
  document.getElementById("hudControl").textContent = controlLabel;
  document.getElementById("hudGate").textContent = disulfide ? "INTEGRITY BEFORE FUNCTION" : "CANDIDATE MUST BEAT CONTROL";
  document.getElementById("hudGateNote").textContent = disulfide ? `A functional effect is not site-specific evidence if ${candidateLabel} also loses expression or fold.` : `Advance only if ${candidateLabel} changes the functional readout more than ${controlLabel} without a matching integrity defect.`;
  const hypothesisElement = document.getElementById("guidanceHypothesis");
  hypothesisElement.dataset.base = hypothesisElement.textContent;
  if (userHypothesis) hypothesisElement.textContent = `User-defined question: “${userHypothesis}” ${hypothesisElement.dataset.base}`;
}

function scoreEquationText(lensName = activeScoringLens) {
  const lens = scoreLenses[lensName] || scoreLenses.general;
  return `score = 100 × [${Object.entries(lens.weights).filter(([,weight])=>weight>0).map(([feature,weight])=>`${weight.toFixed(2)}·${featureLabels[feature]}`).join(" + ")}]; each feature is normalized to the maximum observed in this structure.`;
}

function mutationLabelForResidue(residue) {
  const ladder = mutationLadder(residue);
  return `${mutationRationale(residue,ladder.conservative)} Stronger follow-up: ${ladder.neutral}. These are property probes, not predictions of benefit.`;
}

function matchedControlForResidue(report, residue) {
  return pickMatchedControl(report.allResidues, residue) || report.controlResidue || null;
}

function selectedExperimentQuestion(report, residue) {
  const control = matchedControlForResidue(report, residue);
  const candidateMutation = mutationLadder(residue).conservative;
  const controlMutation = control ? mutationLadder(control).conservative : "the matched-site perturbation";
  const biology = biologicalGuidance(report, residue, control);
  return `Does ${candidateMutation} at ${residue.label} change the result in ${biology.assay} more than ${control ? `${controlMutation} at ${control.label}` : "a matched lower-score control"}, while expression and folding remain comparable to wild type?`;
}

function selectedTestText(report, residue) {
  const control = matchedControlForResidue(report, residue);
  const candidateMutation = mutationLadder(residue).conservative;
  const controlMutation = control ? mutationLadder(control).conservative : "matched perturbation";
  const biology = biologicalGuidance(report, residue, control);
  const question = userHypothesis || selectedExperimentQuestion(report, residue);
  return [
    `RINet controlled residue test — ${current?.sourceName || report.metadata?.pdbId || "structure"}`,
    `Question: ${question}`,
    `Candidate: ${residue.label} (rank ${residue.rank}/${report.allResidues.length}; score ${residue.score.toFixed(1)} under the ${scoreLenses[report.scoringLens].label} model).`,
    `Structural basis: ${residue.rationale}`,
    `Candidate mutation: ${mutationRationale(residue, candidateMutation)}`,
    control ? `Matched control: ${control.label}, ${controlMutation} (match ${control.matchQuality.toFixed(0)}/100). ${control.controlRationale}` : "Matched control: none could be constructed from this coordinate record.",
    `Measure in the same batch: ${biology.assay}; expression or abundance; one orthogonal folding or stability readout. Include wild type, candidate and matched control.`,
    `Supporting result: the candidate changes the functional readout more than the control while expression and folding remain acceptably similar to wild type.`,
    `Stop or reinterpret: candidate and control behave similarly, or the candidate primarily lowers expression or disrupts folding.`,
    `Boundary: structure-derived hypothesis only; confirm numbering, assembly, assay context and external evolutionary or dynamic evidence before assigning mechanism.`
  ].join("\n");
}

function renderEvidenceResiduePicker(report, selected = report.topResidues[0]) {
  const picker = document.getElementById("evidenceResiduePicker");
  if (!picker) return;
  picker.innerHTML = report.topResidues.map(residue => `<button class="evidence-residue-button ${residue.label === selected?.label ? "active" : ""}" type="button" data-evidence-label="${esc(residue.label)}"><span>${String(residue.rank).padStart(2,"0")}</span><strong>${esc(residue.label)}</strong><b>${residue.score.toFixed(1)}</b><small>${esc(residue.context)}</small></button>`).join("");
  picker.querySelectorAll("[data-evidence-label]").forEach(button => button.addEventListener("click", () => {
    const residue = report.allResidues.find(row => row.label === button.dataset.evidenceLabel);
    selectAnalyzedResidue(residue, { autoView:false });
  }));
}

function renderSelectedAction(residue, report = current?.report) {
  if (!residue || !report) return;
  const control = matchedControlForResidue(report, residue);
  const ladder = mutationLadder(residue);
  const biology = biologicalGuidance(report, residue, control);
  document.getElementById("selectedActionResidue").textContent = residue.label;
  document.getElementById("selectedActionScore").textContent = `rank ${residue.rank}/${report.allResidues.length} · score ${residue.score.toFixed(1)} · ${scoreLenses[report.scoringLens].label} model`;
  document.getElementById("selectedActionBoundary").textContent = `${residue.percentile.toFixed(1)}th score percentile in this structure. This is not a probability of function.`;
  document.getElementById("selectedActionReason").textContent = residue.rationale;
  document.getElementById("selectedActionMutation").textContent = mutationRationale(residue, ladder.conservative);
  document.getElementById("selectedActionControl").textContent = control ? `${control.label} · ${mutationLadder(control).conservative} · match ${control.matchQuality.toFixed(0)}/100. ${control.controlRationale}` : "No credible matched control could be constructed from this structure.";
  document.getElementById("selectedActionAssay").textContent = `${biology.assay}; expression or abundance; one folding or stability readout. Run wild type, candidate and control in the same batch.`;
  document.getElementById("selectedActionRule").textContent = `${residue.label} changes the functional readout more than ${control?.label || "the matched control"}, while expression and folding remain acceptably similar to wild type.`;
  renderEvidenceResiduePicker(report, residue);
}

function renderContributionAudit(residue, report = current?.report) {
  if (!residue || !report) return;
  document.getElementById("auditResidue").textContent = `${residue.label} · rank ${residue.rank}/${report.allResidues.length} · ${residue.score.toFixed(1)}`;
  document.getElementById("auditSummary").textContent = `${residue.rationale} Its ${residue.percentile.toFixed(1)}th score percentile means it ranks above ${residue.percentile.toFixed(1)}% of residues under the ${scoreLenses[report.scoringLens].label.toLowerCase()} lens; it is not a probability of function.`;
  const entries = Object.entries(residue.contributions).filter(([feature]) => (report.scoreWeights?.[feature] || 0) > 0).sort((a,b)=>b[1]-a[1]);
  const maximum = Math.max(...entries.map(([,value])=>value),1);
  document.getElementById("contributionChart").innerHTML = entries.map(([feature,value],index)=>`<div class="contribution-row"><span>${esc(featureLabels[feature]||feature)}</span><div><i style="width:${(100*value/maximum).toFixed(1)}%;--bar:${["#c9fb3c","#66d7ff","#b98cff","#ffa95b","#62e3bb"][index%5]}"></i></div><b>${value.toFixed(1)} pts</b></div>`).join("");
  document.getElementById("auditMutation").textContent = mutationLabelForResidue(residue);
  const control = matchedControlForResidue(report, residue);
  document.getElementById("auditControl").textContent = control ? `${control.label} · match quality ${control.matchQuality.toFixed(0)}/100. ${control.controlRationale}` : "No credible matched control could be constructed from this coordinate record.";
  document.querySelectorAll(".sequence-residue").forEach(element => element.classList.toggle("selected", element.dataset.label === residue.label));
  renderSelectedAction(residue, report);
  renderNetworkMap(report,residue);
}

function renderSequence(report, requestedChain = activeSequenceChain) {
  const chains = report.chainReports.map(row=>row.chain);
  activeSequenceChain = chains.includes(requestedChain) ? requestedChain : chains[0];
  document.getElementById("sequenceChainTabs").innerHTML = report.chainReports.map(row=>`<button type="button" role="tab" aria-selected="${row.chain===activeSequenceChain}" class="${row.chain===activeSequenceChain?"active":""}" data-sequence-chain="${esc(row.chain)}">Chain ${esc(row.chain)} · ${row.residues} aa</button>`).join("");
  const residues = report.allResidues.filter(row=>row.chain===activeSequenceChain).sort((a,b)=>a.sequenceIndex-b.sequenceIndex);
  const rankedLabels = new Set(report.topResidues.map(row=>row.label));
  const primary = report.topResidues[0]?.label;
  document.getElementById("sequenceStrip").innerHTML = residues.map(row=>`<button class="sequence-residue ${rankedLabels.has(row.label)?"ranked":""} ${row.label===primary?"rank-one":""} ${row.cdrHeuristic?"cdr-heuristic":""}" type="button" data-label="${esc(row.label)}" title="${esc(row.label)} · score ${row.score.toFixed(1)}"><span>${aminoAcidOneLetter[row.name]||"X"}</span><small>${esc(`${row.seq}${row.insertion||""}`)}</small></button>`).join("");
  document.querySelectorAll("[data-sequence-chain]").forEach(button=>button.addEventListener("click",()=>renderSequence(report,button.dataset.sequenceChain)));
  document.querySelectorAll(".sequence-residue").forEach(button=>button.addEventListener("click",()=>selectAnalyzedResidue(report.allResidues.find(row=>row.label===button.dataset.label),{autoView:true})));
  const blastChain = report.chainReports.find(row=>row.chain===activeSequenceChain)||report.chainReports[0];
  const blastQuery = new URLSearchParams({PROGRAM:"blastp",PAGE_TYPE:"BlastSearch",QUERY:blastChain.sequence,JOB_TITLE:`${report.metadata?.pdbId||current?.sourceName||"RINet"} chain ${blastChain.chain}`});
  document.getElementById("openBlast").href=`https://blast.ncbi.nlm.nih.gov/Blast.cgi?${blastQuery.toString()}`;
  const special = document.getElementById("specialRegionNote");
  special.textContent = report.antibodyContext ? `Antibody-like annotation detected. Chains ${report.antibodyChains.join(", ")||"not confidently assigned"} show CDR-range heuristics based on variable-domain sequence positions 24–35, 50–65 and 89–102. These are prioritization aids, not IMGT/Kabat annotation; verify numbering and antigen contacts before design.` : "Author chain IDs and residue numbers are preserved. Missing coordinates and insertion codes remain explicit. Conservation is not inferred from structure; use FASTA/BLAST when evolutionary evidence matters.";
}

function renderNetworkMap(report, selected = report.topResidues[0]) {
  const svg = document.getElementById("networkMap");
  if (!svg) return;
  const selectedKeys = new Set(report.allResidues.slice(0,90).map(row=>row.key));
  report.edges.forEach(edge => { if (selectedKeys.has(edge.source)) selectedKeys.add(edge.target); if (selectedKeys.has(edge.target)) selectedKeys.add(edge.source); });
  const nodes = report.allResidues.filter(row=>selectedKeys.has(row.key)).slice(0,150).map((row,index)=>({ ...row, x:310+170*Math.cos(2*Math.PI*index/Math.max(1,Math.min(40,report.allResidues.length))), y:210+150*Math.sin(2*Math.PI*index/Math.max(1,Math.min(40,report.allResidues.length))) }));
  const byKey = new Map(nodes.map(node=>[node.key,node]));
  const edges = report.edges.filter(edge=>byKey.has(edge.source)&&byKey.has(edge.target)).slice(0,900);
  for (let iteration=0;iteration<65;iteration+=1) {
    const forces=new Map(nodes.map(node=>[node.key,{x:0,y:0}]));
    for (let i=0;i<nodes.length;i+=1) for (let j=i+1;j<nodes.length;j+=1) {
      const a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=Math.max(25,dx*dx+dy*dy),force=130/d2;
      forces.get(a.key).x+=dx*force;forces.get(a.key).y+=dy*force;forces.get(b.key).x-=dx*force;forces.get(b.key).y-=dy*force;
    }
    edges.forEach(edge=>{const a=byKey.get(edge.source),b=byKey.get(edge.target),dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),force=(d-34)*.012;forces.get(a.key).x+=dx/d*force;forces.get(a.key).y+=dy/d*force;forces.get(b.key).x-=dx/d*force;forces.get(b.key).y-=dy/d*force;});
    nodes.forEach(node=>{const force=forces.get(node.key);node.x=Math.max(14,Math.min(606,node.x+force.x+(310-node.x)*.003));node.y=Math.max(14,Math.min(406,node.y+force.y+(210-node.y)*.003));});
  }
  const chainColors=["#4bc6d9","#738cff","#b98cff","#ff9b5e","#42cf9b","#d9bd54"];
  const chainIndex=new Map(report.chainReports.map((row,index)=>[row.chain,index]));
  svg.innerHTML = `${edges.map(edge=>{const a=byKey.get(edge.source),b=byKey.get(edge.target);return `<line class="network-edge" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;}).join("")}${nodes.map(node=>{const top=node.rank<=10,active=node.label===selected?.label,radius=active?8:top?5:3.1,color=active?"#ff4f91":top?"#c9fb3c":chainColors[(chainIndex.get(node.chain)||0)%chainColors.length];return `<circle class="network-node" data-network-label="${esc(node.label)}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${radius}" fill="${color}"><title>${esc(node.label)} · rank ${node.rank} · score ${node.score.toFixed(1)}</title></circle>${active||node.rank<=5?`<text class="network-label" x="${(node.x+8).toFixed(1)}" y="${(node.y-7).toFixed(1)}">${esc(node.label)}</text>`:""}`;}).join("")}`;
  svg.querySelectorAll("[data-network-label]").forEach(node=>node.addEventListener("click",()=>selectAnalyzedResidue(report.allResidues.find(row=>row.label===node.dataset.networkLabel),{autoView:true})));
}

function renderBenchmark(report) {
  const pdbId=String(report.metadata?.pdbId||current?.sourceName?.match(/[A-Z0-9]{4}/i)?.[0]||"").toUpperCase();
  const benchmark=benchmarkManifest[pdbId];
  if (!benchmark) {
    document.getElementById("benchmarkStatus").textContent="No curated labels bundled for this entry";
    document.getElementById("benchmarkRows").innerHTML="";
    document.getElementById("benchmarkBoundary").textContent="RINet makes no recovery claim for this structure. Importing or curating experimental labels is required before benchmarking.";
    return;
  }
  const byLabel=new Map(report.allResidues.map(row=>[row.label,row]));
  document.getElementById("benchmarkStatus").textContent=benchmark.status;
  document.getElementById("benchmarkRows").innerHTML=benchmark.sites.map(label=>{const row=byLabel.get(label);return `<div class="benchmark-row"><span>${esc(label)}</span><b>${row?`rank ${row.rank}/${report.allResidues.length} · ${row.percentile.toFixed(1)}th percentile`:"not resolved in coordinates"}</b></div>`;}).join("");
  document.getElementById("benchmarkBoundary").innerHTML=`${esc(benchmark.note)} <a href="${benchmark.source}" target="_blank" rel="noreferrer">Source: ${esc(benchmark.citation)} ↗</a>`;
}

function cutoffRanking(report,cutoff) {
  const metrics=report.residueMetrics.map(row=>({...row,degree:0,weighted:0,longRange:0,interchain:0}));
  const byKey=new Map(metrics.map(row=>[row.key,row]));
  const cells=new Map(), key=(x,y,z)=>`${x},${y},${z}`;
  metrics.forEach(a=>{const cell=[Math.floor(a.ca.x/cutoff),Math.floor(a.ca.y/cutoff),Math.floor(a.ca.z/cutoff)];for(let dx=-1;dx<=1;dx+=1)for(let dy=-1;dy<=1;dy+=1)for(let dz=-1;dz<=1;dz+=1)(cells.get(key(cell[0]+dx,cell[1]+dy,cell[2]+dz))||[]).forEach(b=>{if(a.chain===b.chain&&Math.abs(a.sequenceIndex-b.sequenceIndex)<=2)return;const d=distance(a.ca,b.ca);if(d>cutoff)return;a.degree+=1;b.degree+=1;a.weighted+=(cutoff-d)/cutoff;b.weighted+=(cutoff-d)/cutoff;if(a.chain!==b.chain){a.interchain+=1;b.interchain+=1}else if(Math.abs(a.sequenceIndex-b.sequenceIndex)>=12){a.longRange+=1;b.longRange+=1;}});const own=key(...cell);if(!cells.has(own))cells.set(own,[]);cells.get(own).push(a);});
  return scoreResidues(metrics,report.scoringLens);
}

function renderSensitivity(report) {
  const reference=report.topResidues[0];
  const baseTop=new Set(report.topResidues.map(row=>row.label));
  document.getElementById("sensitivityRows").innerHTML=[7,8,9].map(cutoff=>{const ranked=cutoff===report.contactCutoff?report.allResidues:cutoffRanking(report,cutoff);const row=ranked.find(item=>item.label===reference.label);const overlap=ranked.slice(0,10).filter(item=>baseTop.has(item.label)).length;return `<div class="sensitivity-row"><span>${cutoff.toFixed(1)} Å · ${overlap}/10 top-site overlap</span><b>${esc(reference.label)} rank ${row?.rank||"N/A"}</b></div>`;}).join("");
}

function renderExpertRanking(report, query = "") {
  const needle=query.trim().toLowerCase();
  const rows=report.allResidues.filter(row=>!needle||`${row.label} ${row.rationale} ${row.chain}`.toLowerCase().includes(needle)).slice(0,500);
  document.getElementById("expertRows").innerHTML=rows.map(row=>`<tr class="expert-row" data-expert-label="${esc(row.label)}"><td>${row.rank}</td><td>${esc(row.label)}</td><td>${row.score.toFixed(1)}</td><td>${row.degree}</td><td>${row.closeness.toFixed(3)}</td><td>${row.betweenness.toFixed(2)}</td><td>${row.longRange}</td><td>${row.interchain}</td><td>${row.ligandDistance===null?"—":row.ligandDistance.toFixed(1)}</td><td>${esc(row.context)}</td></tr>`).join("");
  document.querySelectorAll("[data-expert-label]").forEach(row=>row.addEventListener("click",()=>selectAnalyzedResidue(report.allResidues.find(item=>item.label===row.dataset.expertLabel),{autoView:true})));
}

function renderScientificPanels(report, selected = report.topResidues[0]) {
  document.getElementById("lensDescription").textContent=scoreLenses[report.scoringLens].description;
  document.getElementById("scoreEquation").textContent=scoreEquationText(report.scoringLens);
  renderContributionAudit(selected,report);
  renderSequence(report);
  renderBenchmark(report);
  renderSensitivity(report);
  renderExpertRanking(report,document.getElementById("rankingFilter")?.value||"");
}

function refreshRankedOutputs(report, { resetSelection = true } = {}) {
  document.getElementById("topologyRows").innerHTML = report.topResidues.map((residue,i)=>`<div class="topology-row"><strong>${String(i+1).padStart(2,"0")} / ${esc(residue.label)}</strong><span>PRIORITY ${residue.score.toFixed(1)} · DEG ${residue.degree}</span></div>`).join("");
  document.getElementById("bestResidueRows").innerHTML = report.topResidues.map((residue,i)=>`<button class="best-residue-row" type="button" data-residue-index="${i}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(residue.label)}<em>${esc(residue.context)}</em></strong><small>${residue.score.toFixed(1)}</small></button>`).join("");
  document.querySelectorAll(".best-residue-row").forEach(button=>button.addEventListener("click",()=>selectAnalyzedResidue(report.topResidues[Number(button.dataset.residueIndex)],{button,autoView:true})));
  renderGuidance(report);renderDiscovery(report,activeDiscoveryMode);renderScientificPanels(report,resetSelection?report.topResidues[0]:(molecular.selectedResidue||report.topResidues[0]));
  molecular.topResidues=report.topResidues;molecular.resultScheme=buildResultColorScheme(report.topResidues);setMolecularRepresentation(molecular.representation);
  if(resetSelection) selectAnalyzedResidue(report.topResidues[0],{autoView:false});
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
  document.getElementById("viewerCoverage").textContent = `${Math.round(100 * (r.residues - r.missingCa) / Math.max(r.residues, 1))}%`;
  document.getElementById("viewerContacts").textContent = r.contacts.toLocaleString();
  document.getElementById("chainRows").innerHTML = r.chainReports.map(chain => `<tr><td>${esc(chain.chain)}</td><td>${chain.residues}</td><td>${chain.atoms}</td><td>${chain.start} to ${chain.end}</td><td>${chain.breaks}</td></tr>`).join("");
  document.getElementById("inventory").textContent = `${r.models} model record${r.models === 1 ? "" : "s"} · ${r.hetero.length} non-water hetero group${r.hetero.length === 1 ? "" : "s"} · ${r.waters} water atom${r.waters === 1 ? "" : "s"}${r.hetero.length ? ` · Hetero inventory: ${r.hetero.slice(0,8).join(", ")}${r.hetero.length > 8 ? "…" : ""}` : ""}`;
  const flags = [
    { warn: r.chainReports.some(c => c.breaks), title: `${r.chainReports.reduce((s,c)=>s+c.breaks,0)} sequence gap / backbone break flags`, note: "Flags combine residue-number gaps and consecutive Cα distances above 4.5 Å." },
    { warn: r.missingCa > 0, title: `${r.missingCa} residues without Cα coordinates`, note: "These residues are omitted from the Cα contact calculation." },
    { warn: r.lowOccupancy > 0, title: `${r.lowOccupancy} polymer atoms below full occupancy`, note: "Inspect alternate states and occupancy semantics before quantitative interpretation." },
    { warn: r.alternateCount > 0, title: `${r.alternateCount} alternate-location atom records beyond blank/A`, note: "The brief uses blank or A conformers for descriptive geometry." },
    { warn: false, title: `${r.disulfides} probable disulfide constraint${r.disulfides === 1 ? "" : "s"}`, note: "Assigned only when cysteine Sγ atoms are 1.7–2.3 Å apart in the supplied coordinates." },
    { warn: false, title: r.metals.length ? `Potential metal groups: ${r.metals.join(", ")}` : "No metal groups detected", note: "Detection uses element labels and does not assign coordination chemistry." }
  ];
  document.getElementById("flagList").innerHTML = flags.map(flag => `<div class="flag ${flag.warn ? "warn" : ""}"><i></i><div><strong>${esc(flag.title)}</strong><span>${esc(flag.note)}</span></div></div>`).join("");
  document.getElementById("topologyRows").innerHTML = r.topResidues.map((residue, i) => `<div class="topology-row"><strong>${String(i+1).padStart(2,"0")} / ${esc(residue.label)}</strong><span>PRIORITY ${residue.score.toFixed(0)} · DEG ${residue.degree}</span></div>`).join("");
  document.getElementById("bestResidueRows").innerHTML = r.topResidues.map((residue, i) => `<button class="best-residue-row" type="button" data-residue-index="${i}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(residue.label)}<em>${esc(residue.context)}</em></strong><small>${residue.score.toFixed(0)}</small></button>`).join("");
  renderGuidance(r);
  renderDiscovery(r, "biology");
  renderScientificPanels(r,r.topResidues[0]);
  const methods = `Coordinates from ${data.sourceName} were parsed locally with RINet Structure Intelligence 3.0 (receipt ${data.receiptId}; ${r.format}). The analyzed model contained ${r.residues} polymer residues and ${r.polymerAtoms} polymer atoms across ${r.chainReports.length} author chain${r.chainReports.length === 1 ? "" : "s"}. A deterministic residue-contact graph was constructed between Cα atoms separated by no more than ${r.contactCutoff.toFixed(1)} Å, excluding residues within two sequence positions on the same chain, yielding ${r.contacts} contacts. ${scoreEquationText(r.scoringLens)} Closeness was ${r.residues <= 1500 ? "calculated on reachable graph components" : "omitted because this very large structure exceeds the interactive all-pairs path limit"}; betweenness was ${r.betweennessCalculated ? "calculated with the unweighted Brandes algorithm" : "omitted because the structure exceeds the 900-residue interactive path limit"}. Known benchmark labels, when available, were evaluated only after ranking and contributed no score. Cysteines received no score bonus; ${r.disulfides} probable disulfide constraint${r.disulfides === 1 ? " was" : "s were"} assigned solely from Sγ separations of 1.7–2.3 Å and treated as an integrity warning. Coordinate screening flagged ${r.chainReports.reduce((s,c)=>s+c.breaks,0)} numbering gap or backbone break${r.chainReports.reduce((s,c)=>s+c.breaks,0) === 1 ? "" : "s"}, ${r.lowOccupancy} polymer atoms below full occupancy and ${r.missingCa} residues without Cα coordinates. B-factor fields were summarized descriptively (mean ${r.bMean === null ? "not available" : r.bMean.toFixed(2)}) and were not assumed to represent prediction confidence. This is a static, coarse residue-network analysis, not an all-atom potential, dynamics calculation, evolutionary analysis or causal claim. No AI or learned model generated the ranking or interpretation.`;
  document.getElementById("methodsText").textContent = methods;
  els.results.classList.remove("hidden");
  document.body.classList.add("analysis-mode");
  document.body.classList.toggle("demo-mode", data.sourceType === "built-in-demo");
  document.getElementById("resultScrollCue")?.classList.remove("dismissed");
  preview.stage?.setSpin(false);
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => { updateResultScrollCue(); updateSectionRail(); });
  renderMolecule(data.rawText, data.sourceName, r.topResidues);
  stopDemoTour();
}

function buildResultColorScheme(topResidues, mode = molecular.colorMode) {
  if (!window.NGL) return null;
  const targets = new Map(topResidues.map((residue, index) => [`${residue.chain}:${residue.seq}${residue.insertion || ""}`, [0xd9ff58, 0x69d7ff, 0xb98cff, 0xffa95b, 0x62e3bb][index]]));
  const chainPalette = [0x2a93a7, 0x5877d8, 0x985fc4, 0xd57a43, 0x2fa77f, 0xb59a32, 0xd65b82, 0x70934b];
  const bValues = current?.report?.residueMetrics?.map(row=>row.bMean).filter(Number.isFinite) || [];
  const bMin = Math.min(...bValues,0), bMax = Math.max(...bValues,1);
  return NGL.ColormakerRegistry.addScheme(function () {
    this.atomColor = atom => {
      const chain = atom.chainname || atom.chainid || "∅";
      const key = `${chain}:${atom.resno}${String(atom.inscode || "").trim()}`;
      if (mode === "priority") return targets.get(key) || 0x2c604f;
      const residue = String(atom.resname || "").toUpperCase();
      if (mode === "charge") {
        if (["ARG","LYS","HIS"].includes(residue)) return 0x3f8cff;
        if (["ASP","GLU"].includes(residue)) return 0xff5d68;
        if (["SER","THR","ASN","GLN","CYS"].includes(residue)) return 0x72d9c0;
        return 0xc1a86b;
      }
      if (mode === "hydrophobicity") {
        if (["ILE","LEU","VAL","MET","ALA","PHE","TRP","PRO"].includes(residue)) return 0xf09a4a;
        if (["ARG","LYS","ASP","GLU","HIS"].includes(residue)) return 0x6ba9ff;
        return 0x71d5b8;
      }
      if (mode === "bfactor") {
        const t = Math.max(0,Math.min(1,((Number(atom.bfactor||atom.b)||0)-bMin)/Math.max(bMax-bMin,1e-9)));
        const red=Math.round(52+203*t), green=Math.round(178-102*t), blue=Math.round(224-116*t);
        return (red<<16)|(green<<8)|blue;
      }
      const chainIndex = [...String(chain)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      return chainPalette[chainIndex % chainPalette.length];
    };
  }, `RINet ${mode} structure map`);
}

function updateColorLegend() {
  const title=document.querySelector("#colorLegend strong"), items=document.getElementById("colorLegendItems");
  if (!title||!items||!current) return;
  const dot=(color,label)=>`<span><i style="background:${color}"></i>${esc(label)}</span>`;
  if(molecular.colorMode==="chain") { title.textContent="CHAIN COLORS"; const palette=["#2a93a7","#5877d8","#985fc4","#d57a43","#2fa77f","#b59a32","#d65b82","#70934b"];items.innerHTML=current.report.chainReports.map((row,index)=>dot(palette[[...String(row.chain)].reduce((sum,char)=>sum+char.charCodeAt(0),0)%palette.length],`chain ${row.chain}`)).join(""); }
  else if(molecular.colorMode==="priority") { title.textContent="RINET PRIORITY";items.innerHTML=dot("#d9ff58","rank 1")+dot("#69d7ff","rank 2")+dot("#b98cff","rank 3")+dot("#2c604f","other residues"); }
  else if(molecular.colorMode==="charge") { title.textContent="SIDE-CHAIN CHARGE";items.innerHTML=dot("#3f8cff","basic")+dot("#ff5d68","acidic")+dot("#72d9c0","polar neutral")+dot("#c1a86b","nonpolar/aromatic"); }
  else if(molecular.colorMode==="hydrophobicity") { title.textContent="HYDROPHOBICITY CLASS";items.innerHTML=dot("#f09a4a","hydrophobic")+dot("#6ba9ff","charged")+dot("#71d5b8","polar/other"); }
  else { title.textContent="B-FACTOR / CONFIDENCE FIELD";items.innerHTML=dot("#34b2e0","lower field")+dot("#ff4c6c","higher field")+"<span>Meaning depends on coordinate source; not automatically confidence.</span>"; }
}

function updateSurfaceStatus(message, ready = false) {
  const status = document.getElementById("surfaceStatus");
  if (!status) return;
  status.classList.toggle("ready", ready);
  status.querySelector("strong").textContent = message;
}

function setMolecularRepresentation(type) {
  molecular.representation = type;
  if (!molecular.component) return;
  molecular.component.removeAllRepresentations();
  if (type === "surface") {
    updateSurfaceStatus("BUILDING COLOR-CODED SURFACE", false);
    molecular.component.addRepresentation("cartoon", { sele: "protein", color: molecular.resultScheme || "#7ee3c5", opacity: .58, quality: "high", aspectRatio: 5.0 });
    molecular.component.addRepresentation("surface", { sele: "protein", surfaceType: "av", probeRadius: 1.4, scaleFactor: 2.0, color: molecular.resultScheme || "#245245", opacity: .88, roughness: .28, quality: "high" });
    molecular.component.addRepresentation("ball+stick", { sele: "not protein and not water", colorScheme: "element", scale: 1.15, quality: "high" });
    setTimeout(() => {
      if (molecular.representation === "surface" && !molecular.selectedResidue) updateSurfaceStatus("COLOR-CODED SURFACE READY", true);
    }, 1800);
  } else {
    molecular.component.addRepresentation("cartoon", { sele: "protein", color: molecular.resultScheme || "#69cbb0", quality: "high", aspectRatio: 5.0 });
    molecular.component.addRepresentation("ball+stick", { sele: "not protein and not water", colorScheme: "element" });
    updateSurfaceStatus("CARTOON MAP READY", true);
  }
  addTargetRepresentations();
  document.querySelectorAll("[data-representation]").forEach(button => button.classList.toggle("active", button.dataset.representation === type));
  updateColorLegend();
}

function residueSelection(residue) {
  return `${residue.seq}${residue.insertion || ""}${residue.chain === "∅" ? "" : `:${residue.chain}`}`;
}

function addTargetRepresentations() {
  if (!molecular.component || !molecular.topResidues.length) return;
  const candidate = molecular.topResidues[0];
  const secondary = molecular.topResidues.slice(1, 5);
  if (secondary.length) molecular.component.addRepresentation("ball+stick", { sele: secondary.map(residueSelection).join(" OR "), color: "#69d7ff", scale: 1.05, opacity: .86, quality: "high" });
  molecular.component.addRepresentation("ball+stick", { sele: residueSelection(candidate), color: "#d9ff58", scale: 1.55, quality: "high" });
  molecular.component.addRepresentation("spacefill", { sele: `${residueSelection(candidate)} and .CA`, color: "#d9ff58", scale: 1.15, quality: "high" });
}

function fitStructureWithPadding(stage, component, duration = 500, padding = 1.32) {
  if (!stage || !component) return;
  component.autoView(0);
  window.setTimeout(() => {
    if (!stage.animationControls || (stage === molecular.stage && component !== molecular.component)) return;
    const center = stage.getCenter?.();
    const zoom = stage.getZoom?.();
    if (!center || !Number.isFinite(zoom)) return;
    stage.animationControls.zoomMove(center, zoom * padding, duration);
  }, 40);
}

async function renderMolecule(text, label, topResidues) {
  if (!window.NGL) return;
  if (!molecular.stage) {
    molecular.stage = new NGL.Stage("moleculeStage", { backgroundColor: "#080b09", cameraType: "perspective", quality: "high", sampleLevel: 1 });
    molecular.stage.setParameters({ backgroundColor: "#080b09", fogNear: 50, fogFar: 100, lightIntensity: 1.1, ambientIntensity: .42 });
    molecular.stage.signals.clicked.add(handleMolecularPick);
    window.addEventListener("resize", () => molecular.stage.handleResize());
  }
  molecular.stage.removeAllComponents(); molecular.component = null; molecular.highlight = null; molecular.selectedResidue = null;
  molecular.topResidues = topResidues || [];
  molecular.resultScheme = buildResultColorScheme(molecular.topResidues);
  document.getElementById("viewerLabel").textContent = label;
  const blob = new Blob([text], { type: "text/plain" });
  Object.defineProperty(blob, "name", { value: label });
  try {
    molecular.component = await molecular.stage.loadFile(blob, { ext: label.toLowerCase().endsWith(".cif") || label.toLowerCase().endsWith(".mmcif") ? "cif" : "pdb", defaultRepresentation: false });
    setMolecularRepresentation(molecular.representation);
    fitStructureWithPadding(molecular.stage, molecular.component, 500, 1.32);
    molecular.stage.setSpin(false);
    molecular.spinning = false;
    document.getElementById("viewerSpin").textContent = "Start rotation";
    updateColorLegend();
    document.querySelectorAll(".best-residue-row").forEach(button => button.addEventListener("click", () => selectAnalyzedResidue(topResidues[Number(button.dataset.residueIndex)], { button, autoView: true })));
  } catch (error) {
    document.getElementById("viewerLabel").textContent = `Viewer unavailable: ${error.message}`;
  }
}

async function initPreview() {
  if (!window.NGL || !document.getElementById("previewMolecule")) return;
  try {
    const response = await fetch("/brief/demo/1crn.pdb", { cache: "force-cache" });
    if (!response.ok) return;
    const text = await response.text();
    const blob = new Blob([text], { type: "text/plain" });
    Object.defineProperty(blob, "name", { value: "1crn.pdb" });
    preview.stage = new NGL.Stage("previewMolecule", { backgroundColor: "#070a08", cameraType: "perspective", quality: "high", sampleLevel: 1 });
    preview.stage.setParameters({ backgroundColor: "#070a08", fogNear: 48, fogFar: 100, lightIntensity: 1.12, ambientIntensity: .46 });
    preview.component = await preview.stage.loadFile(blob, { ext: "pdb", defaultRepresentation: false });
    preview.component.addRepresentation("surface", { sele: "protein", surfaceType: "av", probeRadius: 1.4, scaleFactor: 2.0, color: "#285947", opacity: .92, roughness: .3 });
    preview.component.addRepresentation("cartoon", { sele: "protein", color: "#85efcb", opacity: .2, quality: "high" });
    preview.component.addRepresentation("ball+stick", { sele: "32:A", color: "#d9ff58", scale: 1.5, quality: "high" });
    fitStructureWithPadding(preview.stage, preview.component, 0, 1.18);
    preview.stage.setSpin(false);
    window.addEventListener("resize", () => preview.stage?.handleResize());
  } catch (_) {
    // The launch console remains fully usable if WebGL preview initialization fails.
  }
}

function residueExplanation(residue) {
  if (residue.disulfidePartner) return `PROBABLE DISULFIDE · ${residue.disulfidePartner.distance.toFixed(2)} Å TO ${residue.disulfidePartner.label.toUpperCase()}`;
  if (residue.directMetalCoordination) return `${residue.ligandDistance.toFixed(1)} Å DIRECT ${residue.nearestLigandElement} CONTACT · EXPLICIT COORDINATION EVIDENCE`;
  if (residue.ligandDistance !== null && residue.ligandDistance <= 6) return `${residue.ligandDistance.toFixed(1)} Å FROM ${residue.nearestLigand || "BOUND GROUP"} · TEST LOCAL CHEMISTRY`;
  if (residue.interchain) return `${residue.interchain} CROSS-CHAIN CONTACTS · TEST ASSEMBLY COMMUNICATION`;
  return `${residue.degree} NON-LOCAL CONTACTS · TEST STRUCTURE TO FUNCTION`;
}

function selectAnalyzedResidue(residue, { button = null, autoView = false, updateDiscovery = true } = {}) {
  if (!molecular.component || !residue) return;
  if (molecular.highlight) molecular.highlight.forEach(representation => molecular.component.removeRepresentation(representation));
  const selection = residueSelection(residue);
  molecular.highlight = [
    molecular.component.addRepresentation("ball+stick", { sele: selection, color: "#ff6f9f", scale: 1.65, quality: "high" }),
    molecular.component.addRepresentation("spacefill", { sele: `${selection} and .CA`, color: "#ff6f9f", scale: 1.2, quality: "high" })
  ];
  if (autoView) molecular.component.autoView(selection, 450);
  molecular.selectedResidue = residue;
  const comparison = current?.report ? matchedControlForResidue(current.report, residue) : null;
  const ladder = mutationLadder(residue);
  document.getElementById("viewerCandidate").textContent = residue.label;
  document.getElementById("viewerCandidateReason").textContent = residueExplanation(residue);
  document.getElementById("hudThesis").textContent = `${residue.label} is now selected. ${residue.context}. Compare its effect with ${comparison?.label || "a matched structural site"}.`;
  document.getElementById("hudMutation").textContent = ladder.conservative;
  document.getElementById("hudMutationNote").textContent = `Least severe informative change at ${residue.label}.`;
  document.getElementById("hudGate").textContent = residue.disulfidePartner ? "INTEGRITY BEFORE FUNCTION" : "SELECTED SITE MUST BEAT CONTROL";
  document.getElementById("hudGateNote").textContent = `Interpret function only if ${residue.label} remains expressed and structurally intact.`;
  updateSurfaceStatus(`SELECTED SITE · ${residue.label.toUpperCase()}`, true);
  document.querySelectorAll(".best-residue-row").forEach(row => {
    const ranked = molecular.topResidues[Number(row.dataset.residueIndex)];
    row.classList.toggle("active", row === button || ranked?.label === residue.label);
  });
  renderContributionAudit(residue,current?.report);
  if (current && suggestedHypothesisActive) {
    userHypothesis = selectedExperimentQuestion(current.report, residue);
    document.getElementById("hypothesisInput").value = userHypothesis;
    const feedback = document.getElementById("hypothesisFeedback");
    feedback.textContent = `Suggested question updated for ${residue.label}. Scores and ranks are unchanged.`;
    feedback.classList.add("applied");
  }
  if (current) renderGuidance(current.report, residue);
  if (updateDiscovery && current) renderDiscovery(current.report, activeDiscoveryMode);
  const actionStatus = document.getElementById("selectedActionStatus");
  if (actionStatus) {
    actionStatus.textContent = `${residue.label} selected. Score breakdown, control and experiment updated.`;
    actionStatus.classList.add("success");
  }
}

function selectBoundGroup(atom) {
  if (!atom) return;
  const chain = atom.chainname || atom.chainid || "∅";
  const label = `${atom.resname || "BOUND GROUP"} ${chain}:${atom.resno}`;
  const selection = `${atom.resno}${chain === "∅" ? "" : `:${chain}`} and not protein`;
  if (molecular.highlight) molecular.highlight.forEach(representation => molecular.component.removeRepresentation(representation));
  molecular.highlight = [molecular.component.addRepresentation("ball+stick", { sele: selection, colorScheme: "element", scale: 1.8, quality: "high" })];
  molecular.selectedResidue = null;
  document.getElementById("viewerCandidate").textContent = label;
  document.getElementById("viewerCandidateReason").textContent = "BOUND CHEMISTRY · CLICK A NEARBY RESIDUE TO COMPARE SITES";
  document.getElementById("hudThesis").textContent = `${label} marks a chemistry-linked neighborhood. Test nearby residues only after confirming that this group is biologically relevant.`;
  document.getElementById("hudMutation").textContent = "Inspect lining residues";
  document.getElementById("hudMutationNote").textContent = "Choose a direct contact and a similarly buried non-contact comparison.";
  document.getElementById("hudGate").textContent = "SEPARATE BINDING FROM FOLD";
  document.getElementById("hudGateNote").textContent = "A change in bound-group signal is interpretable only if abundance and fold remain intact.";
  updateSurfaceStatus(`BOUND GROUP · ${label.toUpperCase()}`, true);
  document.querySelectorAll(".best-residue-row").forEach(row => row.classList.remove("active"));
}

function handleMolecularPick(pickingProxy) {
  const atom = pickingProxy?.atom;
  if (!atom || !current?.report) return;
  const chain = atom.chainname || atom.chainid || "∅";
  const insertion = String(atom.inscode || "").trim();
  const residue = current.report.allResidues.find(row => row.chain === chain && row.seq === atom.resno && (row.insertion || "") === insertion);
  if (residue) selectAnalyzedResidue(residue, { autoView: false });
  else if (!waterNames.has(atom.resname)) selectBoundGroup(atom);
}

document.querySelectorAll("[data-representation]").forEach(button => button.addEventListener("click", () => setMolecularRepresentation(button.dataset.representation)));
document.getElementById("viewerColor")?.addEventListener("change", event => {
  molecular.colorMode=event.currentTarget.value;
  molecular.resultScheme=buildResultColorScheme(molecular.topResidues,molecular.colorMode);
  setMolecularRepresentation(molecular.representation);
});
document.getElementById("viewerBackground")?.addEventListener("change", event => {
  molecular.background=event.currentTarget.value;
  const light=molecular.background==="white";
  document.querySelector(".molecule-stage-wrap")?.classList.toggle("viewer-light",light);
  molecular.stage?.setParameters({backgroundColor:light?"#ffffff":"#080b09"});
});
document.querySelectorAll("[data-discovery-mode]").forEach(button => button.addEventListener("click", () => {
  if (!current) return;
  const mode = button.dataset.discoveryMode;
  renderDiscovery(current.report, mode);
  const targets = {
    biology: current.report.topResidues[0],
    engineering: current.report.topResidues[1] || current.report.topResidues[0],
    translation: current.report.controlResidue || current.report.topResidues.at(-1),
    mechanism: current.report.allResidues.filter(residue => residue.interchain).sort((a, b) => b.interchain - a.interchain || b.score - a.score)[0] || current.report.topResidues[2] || current.report.topResidues[0]
  };
  selectAnalyzedResidue(targets[mode], { autoView: true, updateDiscovery: false });
  document.getElementById("discoveryGrounding").textContent = discoveryGrounding(current.report);
}));
document.getElementById("viewerFit").addEventListener("click", () => {
  if (!molecular.component) return;
  if (molecular.highlight) molecular.highlight.forEach(representation=>molecular.component.removeRepresentation(representation));
  molecular.highlight=null;molecular.selectedResidue=null;
  setMolecularRepresentation(molecular.representation);
  fitStructureWithPadding(molecular.stage, molecular.component, 450, 1.32);
  document.querySelectorAll(".best-residue-row,.sequence-residue").forEach(element=>element.classList.remove("active","selected"));
  if (current?.report?.topResidues[0]) {
    renderContributionAudit(current.report.topResidues[0], current.report);
    renderGuidance(current.report, current.report.topResidues[0]);
  }
  updateSurfaceStatus("FULL STRUCTURE RESTORED",true);
});
document.getElementById("viewerSpin").addEventListener("click", event => {
  if (!molecular.stage) return;
  molecular.spinning = !molecular.spinning;
  molecular.stage.setSpin(molecular.spinning ? [0, 1, .06] : false, .00155);
  event.currentTarget.textContent = molecular.spinning ? "Stop rotation" : "Start rotation";
});
document.getElementById("newAnalysis").addEventListener("click", () => { window.location.href = "/brief/"; });
document.getElementById("resultScrollCue")?.addEventListener("click", event => {
  event.preventDefault();
  stopDemoTour();
  event.currentTarget.classList.add("dismissed");
  document.getElementById("scoringSection")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});
document.getElementById("demoSkipStatus")?.addEventListener("click", stopDemoTour);
function updateResultScrollCue() {
  const cue = document.getElementById("resultScrollCue");
  if (!cue || !document.body.classList.contains("analysis-mode")) return;
  const pageBottom = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  cue.classList.toggle("dismissed", activeSectionIndex() > 0 || window.scrollY >= pageBottom - 2);
}
window.addEventListener("scroll", () => { updateResultScrollCue(); updateSectionRail(); }, { passive: true });
window.addEventListener("resize", () => { updateResultScrollCue(); updateSectionRail(); }, { passive: true });

document.querySelectorAll("[data-scoring-lens]").forEach(button=>button.addEventListener("click",()=>{
  if(!current)return;
  activeScoringLens=button.dataset.scoringLens;
  document.querySelectorAll("[data-scoring-lens]").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-selected",String(active));});
  rerankReport(current.report,activeScoringLens);
  refreshRankedOutputs(current.report);
  document.getElementById("methodsText").textContent=document.getElementById("methodsText").textContent.replace(/score = 100 × \[[^\]]+\]; each feature is normalized to the maximum observed in this structure\./,scoreEquationText(activeScoringLens));
  setLocalActionStatus(`Ranking recalculated with the ${scoreLenses[activeScoringLens].label} model. ${current.report.topResidues[0].label} is now rank 1.`, true);
}));

function currentEvidenceResidue() {
  return molecular.selectedResidue || current?.report?.topResidues?.[0] || null;
}

function setLocalActionStatus(message, success = false) {
  const status = document.getElementById("selectedActionStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("success", success);
}

function openCopyDialog(title, text) {
  const dialog = document.getElementById("copyDialog");
  const field = document.getElementById("copyDialogText");
  document.getElementById("copyDialogTitle").textContent = title;
  field.value = text;
  if (!dialog.open) dialog.showModal();
  window.requestAnimationFrame(() => { field.focus(); field.select(); });
}

document.getElementById("applyHypothesis")?.addEventListener("click",()=>{
  userHypothesis=document.getElementById("hypothesisInput").value.trim();
  if(!current)return;
  const residue = currentEvidenceResidue();
  renderGuidance(current.report, residue || current.report.topResidues[0]);
  if (residue) renderSelectedAction(residue, current.report);
  const feedback = document.getElementById("hypothesisFeedback");
  feedback.textContent=userHypothesis?`Question set: “${userHypothesis}” Scores and ranks are unchanged.`:"Question cleared. Scores and ranks are unchanged.";
  feedback.classList.toggle("applied", Boolean(userHypothesis));
  const button = document.getElementById("applyHypothesis");
  button.textContent=userHypothesis?"Question set":"Question cleared";
  window.setTimeout(()=>button.textContent="Set experiment question",1500);
  const status=document.getElementById("analysisStatus");
  status.textContent=userHypothesis?"Experiment question set. Structural scores are unchanged.":"Experiment question cleared. Structural scores are unchanged.";
  setLocalActionStatus(userHypothesis?"Experiment question updated. Open the copyable test to export it with the residue evidence.":"Experiment question cleared.",Boolean(userHypothesis));
});

document.getElementById("suggestHypothesis")?.addEventListener("click",()=>{
  if(!current)return;
  const residue=currentEvidenceResidue()||current.report.topResidues[0];
  suggestedHypothesisActive=true;
  document.getElementById("hypothesisInput").value=selectedExperimentQuestion(current.report,residue);
  document.getElementById("applyHypothesis").click();
});
document.getElementById("hypothesisInput")?.addEventListener("input",()=>{suggestedHypothesisActive=false;});

document.getElementById("actionFocusStructure")?.addEventListener("click",()=>{
  const residue=currentEvidenceResidue();
  if(!residue)return;
  selectAnalyzedResidue(residue,{autoView:true});
  document.getElementById("structureSection")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
});

document.getElementById("actionOpenSequence")?.addEventListener("click",()=>{
  const residue=currentEvidenceResidue();
  if(!current||!residue)return;
  renderSequence(current.report,residue.chain);
  document.querySelectorAll(".sequence-residue").forEach(element=>element.classList.toggle("selected",element.dataset.label===residue.label));
  document.getElementById("sequenceSection")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
});

const copySelectedTestButton = document.getElementById("copySelectedTest");
if (copySelectedTestButton) copySelectedTestButton.onclick = () => {
  const residue=currentEvidenceResidue();
  if(!current||!residue)return;
  openCopyDialog(`${residue.label} controlled test`, selectedTestText(current.report,residue));
  setLocalActionStatus("Controlled test opened with candidate, matched control, assay, decision rule and limitations.",true);
};

document.getElementById("actionOpenExperiment")?.addEventListener("click",()=>{
  const residue=currentEvidenceResidue();
  if(!current||!residue)return;
  renderGuidance(current.report,residue);
  document.getElementById("decisionBrief")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
});

document.getElementById("rankingFilter")?.addEventListener("input",event=>{if(current)renderExpertRanking(current.report,event.currentTarget.value);});

function activeFasta(report=current?.report){
  if(!report)return"";
  return report.chainReports.map(chain=>`>${report.metadata?.pdbId||current.sourceName}|chain_${chain.chain}|author_numbering_${chain.start}-${chain.end}\n${chain.sequence.match(/.{1,70}/g)?.join("\n")||chain.sequence}`).join("\n");
}
document.getElementById("copyFasta")?.addEventListener("click",()=>openCopyDialog(`FASTA · ${activeSequenceChain || "selected chain"}`,activeFasta()));
document.getElementById("stateFileInput")?.addEventListener("change",async event=>{
  const file=event.currentTarget.files?.[0];if(!file||!current)return;
  const target=document.getElementById("stateComparison");target.textContent=`Comparing ${file.name} with ${current.sourceName}…`;
  try{
    const second=parseCoordinateFile(await file.text(),file.name);rerankReport(second,current.report.scoringLens);
    const secondByLabel=new Map(second.allResidues.map(row=>[row.label,row]));
    const comparisons=current.report.topResidues.map(first=>({first,second:secondByLabel.get(first.label)})).filter(row=>row.second);
    if(!comparisons.length)throw new Error("no matching author chain/residue identifiers; reconcile numbering before state comparison");
    target.innerHTML=`<p><b>${comparisons.length}/10 primary-state top sites matched by exact author identifier.</b> Positive Δdegree means contacts gained in the second state.</p>${comparisons.map(({first,second:other})=>`<div class="sensitivity-row"><span>${esc(first.label)} · Δdegree ${(other.degree-first.degree)>=0?"+":""}${other.degree-first.degree} · Δinterchain ${(other.interchain-first.interchain)>=0?"+":""}${other.interchain-first.interchain}</span><b>rank ${first.rank} → ${other.rank}</b></div>`).join("")}<p>Comparison is coordinate-state evidence only; unequal constructs, ligands, assemblies or missing residues can cause apparent changes.</p>`;
  }catch(error){target.textContent=`State comparison stopped: ${error.message}.`;}
});

document.getElementById("copyMethods").addEventListener("click",()=>openCopyDialog("Reproducible methods",document.getElementById("methodsText").textContent));
document.getElementById("closeCopyDialog")?.addEventListener("click",()=>document.getElementById("copyDialog")?.close());
document.getElementById("copyDialog")?.addEventListener("click",event=>{if(event.target===event.currentTarget)event.currentTarget.close();});

function receiptPayload() {
  return { tool: "RINet Structure Intelligence", version: "3.0", receiptId: current.receiptId, analyzedAt: current.analyzedAt, sourceLabel: current.sourceName, sourceType: current.sourceType, structureSha256: current.digest, userHypothesis:userHypothesis||null, scoringLens:current.report.scoringLens, exactScoreWeights:current.report.scoreWeights, contactCutoffAngstrom:current.report.contactCutoff, benchmarkManifest:benchmarkManifest[current.report.metadata?.pdbId]||null, summary: current.report, scientificBoundary: "Static, descriptive coordinate and Cα contact analysis; not an all-atom potential, evolutionary analysis, dynamics calculation, functional proof or causal claim." };
}

document.getElementById("downloadReceipt").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(receiptPayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${current.receiptId.toLowerCase()}-structure-brief.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
});

switchSource("id", false);
window.scrollTo({ top: 0, behavior: "auto" });
initPreview();
if (new URLSearchParams(window.location.search).get("demo") === "1") loadDemo();
