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
let activeTargetId = null;
let activeSequenceChain = null;
let customAssay = "";
const adaptiveRound = { panelSize: 8, panel: [], results: new Map(), example: false };
const preview = { stage: null, component: null };
const demoTour = { timer: null, frame: null, active: false };
const waterNames = new Set(["HOH", "WAT", "DOD"]);
const metalElements = new Set(["LI", "NA", "MG", "AL", "K", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "SR", "MO", "CD", "CS", "BA", "HG"]);
const aminoAcidOneLetter = { ALA:"A", ARG:"R", ASN:"N", ASP:"D", CYS:"C", GLN:"Q", GLU:"E", GLY:"G", HIS:"H", ILE:"I", LEU:"L", LYS:"K", MET:"M", PHE:"F", PRO:"P", SER:"S", THR:"T", TRP:"W", TYR:"Y", VAL:"V", SEC:"U", PYL:"O" };
const featureLabels = { mechanical:"Target-compliance sensitivity", robustness:"Sensitivity stability across cutoffs", perturbation:"Mutation constraint leverage", degree:"Cα contact degree", weighted:"Cα distance-weighted packing", longRange:"Cα long-range contacts", interchain:"Cα cross-chain contacts", closeness:"Cα closeness centrality", betweenness:"Cα betweenness centrality", burial:"Radial burial", ligand:"Nearest bound-group distance", coordination:"Direct metal coordination", cdr:"CDR-region evidence", atomic:"Typed atomic partners", polar:"Polar-contact geometry", ionic:"Ionic-contact geometry", ligandAtomic:"Direct ligand / metal contacts" };
const graphFeatureNames = ["degree","weighted","longRange","interchain","closeness","betweenness"];
const localFeatureNames = ["atomic","polar","ionic","ligandAtomic","coordination","ligand","burial"];
const scoreLenses = {
  general: { label:"Target sensitivity", description:"Target-sensitivity question: ranks mutations outside the selected functional site by the first-order change in target compliance expected when local springs are weakened, stability across three network cutoffs, and the side-chain constraints the proposed substitution can change.", weights:{ mechanical:.58, robustness:.17, perturbation:.10, interchain:.03, longRange:.03, burial:.02, atomic:.03, polar:.02, ionic:.01, ligandAtomic:.01 } },
  ligand: { label:"Direct pocket", description:"Direct-pocket question: ranks residues that touch the selected bound group, combining target response with explicit ligand/metal geometry and mutation constraint leverage.", weights:{ mechanical:.30, robustness:.10, perturbation:.15, ligandAtomic:.20, coordination:.10, ligand:.05, atomic:.04, polar:.03, ionic:.03 } },
  interface: { label:"Interface sensitivity", description:"Interface question: asks which mutation should most change compliance of the selected chain interface while retaining explicit cross-chain contact evidence. Confirm that the interface belongs to the biological assembly.", weights:{ mechanical:.50, robustness:.15, perturbation:.10, interchain:.15, atomic:.05, polar:.03, ionic:.02 } },
  allostery: { label:"Remote sensitivity", description:"Remote-sensitivity question: excludes the selected site and residues within 10 Å, then ranks remote residues by target-compliance sensitivity and cutoff robustness. This is the clearest candidate-versus-control test of long-range mechanical leverage.", weights:{ mechanical:.64, robustness:.19, perturbation:.10, longRange:.03, betweenness:.02, atomic:.02 } },
  stability: { label:"Mechanical integrity", description:"Mechanical-integrity question: combines target-compliance sensitivity with packing, burial and mutation leverage. Protein quantity and fold/assembly remain mandatory measurements.", weights:{ mechanical:.34, robustness:.11, perturbation:.15, weighted:.12, burial:.12, degree:.06, atomic:.10 } },
  antibody: { label:"Antibody interface", description:"Antibody-interface question: combines target-compliance sensitivity at the selected interface with cross-chain contacts and a variable-loop heuristic. Verify IMGT/Kabat numbering and antigen identity before ordering constructs.", weights:{ mechanical:.38, robustness:.12, perturbation:.10, interchain:.16, cdr:.14, atomic:.05, polar:.03, ionic:.02 } }
};
const workflowQuestions = {
  general:"Which mutation should most change the mechanical compliance of the functional site?",
  ligand:"Which residue most directly perturbs bound ligand or metal chemistry?",
  interface:"Which residue most clearly tests a chain or partner interface?",
  allostery:"Which distant mutation should most change the mechanical compliance of the functional site?",
  stability:"Which residue provides a clean test of packing or structural tolerance?",
  antibody:"Which residue most clearly tests antigen-contact or CDR-region function?"
};
const benchmarkManifest = {
  "4HHB": {
    status:"Three independent 4HHB anchors · evaluated after ranking",
    note:"These labels never enter the target-compliance score. Recovery in one protein is a retrospective sanity check, not general validation.",
    groups:[
      { label:"αArg141 · C-terminal T-state contact", sites:["ARG A:141","ARG C:141"], perturbation:"R141S", outcome:"Raised oxygen affinity and reduced cooperativity; implicated in T-state stabilization and the Bohr effect.", source:"https://pubmed.ncbi.nlm.nih.gov/7338473/", citation:"Experimental α141 Arg→Ser hemoglobin" },
      { label:"βAsp99 · α1β2 allosteric interface", sites:["ASP B:99","ASP D:99"], perturbation:"D99N (Hb Kempsey)", outcome:"High oxygen affinity with markedly reduced cooperativity; disrupts a T-state interface contact.", source:"https://pubmed.ncbi.nlm.nih.gov/1427427/", citation:"Functional study of Hb Kempsey β99 Asp→Asn" },
      { label:"Proximal F8 histidines · heme anchor", sites:["HIS A:87","HIS B:92","HIS C:87","HIS D:92"], perturbation:"Direct structural anchor", outcome:"Coordinates the heme iron; used here to check residue/ligand assignment, not long-range ranking.", source:"https://www.rcsb.org/structure/4HHB", citation:"4HHB structure and heme coordination" }
    ]
  },
  "5DTL": {
    status:"One independent mEos2 anchor · evaluated after ranking",
    note:"The published label never enters the score. This is a retrospective sanity check, not general validation.",
    groups:[
      { label:"Arg66 · chromophore-state control", sites:["ARG A:66","ARG B:66","ARG C:66","ARG D:66","ARG E:66"], perturbation:"Published Arg66 variants", outcome:"Arg66 controls dark-state formation in mEos2.", source:"https://doi.org/10.1021/jacs.5b09923", citation:"Arginine 66 controls dark-state formation in mEos2" }
    ]
  }
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
const backboneAtomNames = new Set(["N","CA","C","O","OXT"]);
const hydrophobicResidues = new Set(["ALA","VAL","ILE","LEU","MET","PHE","TRP","TYR","PRO"]);
const aromaticResidues = new Set(["PHE","TYR","TRP","HIS"]);
const aromaticAtomNames = {
  PHE:new Set(["CG","CD1","CD2","CE1","CE2","CZ"]), TYR:new Set(["CG","CD1","CD2","CE1","CE2","CZ"]),
  TRP:new Set(["CG","CD1","CD2","NE1","CE2","CE3","CZ2","CZ3","CH2"]), HIS:new Set(["CG","ND1","CD2","CE1","NE2"])
};
const oneToThree = Object.fromEntries(Object.entries(aminoAcidOneLetter).map(([three,one]) => [one,three]));
const mutationCapabilities = {
  polar:new Set(["ARG","LYS","HIS","ASP","GLU","ASN","GLN","SER","THR","TYR","TRP","CYS"]),
  positive:new Set(["ARG","LYS"]), negative:new Set(["ASP","GLU"]), hydrophobic:hydrophobicResidues,
  aromatic:aromaticResidues, disulfide:new Set(["CYS"]), metal:new Set(["HIS","CYS","ASP","GLU","ASN","GLN","SER","THR","TYR"]), imidazole:new Set(["HIS"])
};

function atomIsHeavy(atom) { return atom && atom.element !== "H" && [atom.x,atom.y,atom.z].every(Number.isFinite); }
function atomIsSidechain(atom) { return atom && !backboneAtomNames.has(atom.atom); }
function atomIsAcidic(residue, atom) { return (residue.name === "ASP" && ["OD1","OD2"].includes(atom.atom)) || (residue.name === "GLU" && ["OE1","OE2"].includes(atom.atom)); }
function atomIsBasic(residue, atom) { return (residue.name === "ARG" && ["NE","NH1","NH2"].includes(atom.atom)) || (residue.name === "LYS" && atom.atom === "NZ"); }
function atomIsAromatic(residue, atom) { return aromaticAtomNames[residue.name]?.has(atom.atom) || false; }
function interactionTypeLabel(type) {
  return ({ direct:"atomic contact", polar:"polar proximity", ionic:"ionic geometry", hydrophobic:"hydrophobic contact", aromatic:"aromatic proximity", disulfide:"disulfide geometry", ligand:"ligand contact", ligandPolar:"ligand polar proximity", metal:"metal coordination" })[type] || type;
}

function buildTypedInteractionEvidence(residues, heteroAtoms) {
  const evidence = new Map(residues.map(residue => [residue.key, { interactions:[], atomicPartners:new Set(), polarPartners:new Set(), ionicPartners:new Set(), hydrophobicPartners:new Set(), aromaticPartners:new Set(), ligandPartners:new Set(), metalPartners:new Set() }]));
  const residuePairs = new Map();
  const heavy = residues.flatMap(residue => residue.atoms.filter(atomIsHeavy).map(atom => ({ atom, residue })));
  const cutoff = 5.5;
  const cells = new Map();
  const cellKey = (x,y,z) => `${x},${y},${z}`;
  const recordResiduePair = (left, right, type, separation) => {
    const ordered = left.residue.key.localeCompare(right.residue.key) <= 0 ? [left,right] : [right,left];
    const key = `${ordered[0].residue.key}|${ordered[1].residue.key}|${type}`;
    const existing = residuePairs.get(key);
    if (!existing || separation < existing.distance) residuePairs.set(key, { left:ordered[0], right:ordered[1], type, distance:separation });
  };
  heavy.forEach(left => {
    const cell = [Math.floor(left.atom.x/cutoff),Math.floor(left.atom.y/cutoff),Math.floor(left.atom.z/cutoff)];
    for (let dx=-1;dx<=1;dx+=1) for (let dy=-1;dy<=1;dy+=1) for (let dz=-1;dz<=1;dz+=1) {
      (cells.get(cellKey(cell[0]+dx,cell[1]+dy,cell[2]+dz)) || []).forEach(right => {
        if (left.residue.key === right.residue.key) return;
        const adjacent = left.residue.chain === right.residue.chain && Math.abs(left.residue.sequenceIndex-right.residue.sequenceIndex) <= 1;
        if (adjacent && (!atomIsSidechain(left.atom) || !atomIsSidechain(right.atom))) return;
        const separation = distance(left.atom,right.atom);
        if (separation > cutoff || separation < 1.2) return;
        const sidechainInvolved = atomIsSidechain(left.atom) || atomIsSidechain(right.atom);
        if (separation <= 4.5 && sidechainInvolved) recordResiduePair(left,right,"direct",separation);
        if (separation >= 2.35 && separation <= 3.6 && sidechainInvolved && ["N","O","S"].includes(left.atom.element) && ["N","O","S"].includes(right.atom.element)) recordResiduePair(left,right,"polar",separation);
        if (separation <= 4.0 && ((atomIsAcidic(left.residue,left.atom) && atomIsBasic(right.residue,right.atom)) || (atomIsBasic(left.residue,left.atom) && atomIsAcidic(right.residue,right.atom)))) recordResiduePair(left,right,"ionic",separation);
        if (separation >= 3.0 && separation <= 4.6 && atomIsSidechain(left.atom) && atomIsSidechain(right.atom) && hydrophobicResidues.has(left.residue.name) && hydrophobicResidues.has(right.residue.name) && ["C","S"].includes(left.atom.element) && ["C","S"].includes(right.atom.element)) recordResiduePair(left,right,"hydrophobic",separation);
        if (separation >= 3.2 && separation <= 5.5 && atomIsAromatic(left.residue,left.atom) && atomIsAromatic(right.residue,right.atom)) recordResiduePair(left,right,"aromatic",separation);
        if (left.residue.name === "CYS" && right.residue.name === "CYS" && left.atom.atom === "SG" && right.atom.atom === "SG" && separation >= 1.7 && separation <= 2.3) recordResiduePair(left,right,"disulfide",separation);
      });
    }
    const own = cellKey(...cell);
    if (!cells.has(own)) cells.set(own,[]);
    cells.get(own).push(left);
  });
  const addOriented = (entry, own, partner) => {
    const target = evidence.get(own.residue.key);
    if (!target) return;
    const partnerKey = partner.residue.key;
    const sidechain=atomIsSidechain(own.atom);
    if (sidechain && entry.type === "direct") target.atomicPartners.add(partnerKey);
    if (sidechain && entry.type === "polar") target.polarPartners.add(partnerKey);
    if (sidechain && entry.type === "ionic") target.ionicPartners.add(partnerKey);
    if (sidechain && entry.type === "hydrophobic") target.hydrophobicPartners.add(partnerKey);
    if (sidechain && entry.type === "aromatic") target.aromaticPartners.add(partnerKey);
    target.interactions.push({ type:entry.type, partnerKey, partnerLabel:`${partner.residue.name} ${partner.residue.chain}:${partner.residue.seq}${partner.residue.insertion}`, distance:entry.distance, atom:own.atom.atom, partnerAtom:partner.atom.atom, sidechain, interchain:own.residue.chain !== partner.residue.chain });
  };
  residuePairs.forEach(entry => { addOriented(entry,entry.left,entry.right); addOriented(entry,entry.right,entry.left); });

  const heteroPairs = new Map();
  const heteroCells = new Map();
  heteroAtoms.filter(atomIsHeavy).forEach(atom => {
    const cell = [Math.floor(atom.x/4.5),Math.floor(atom.y/4.5),Math.floor(atom.z/4.5)];
    const own = cellKey(...cell); if (!heteroCells.has(own)) heteroCells.set(own,[]); heteroCells.get(own).push(atom);
  });
  const recordHetero = (residueEntry, hetero, type, separation) => {
    const groupKey = `${hetero.residue}:${hetero.chain}:${hetero.seq}`;
    const key = `${residueEntry.residue.key}|${groupKey}|${type}`;
    const existing = heteroPairs.get(key);
    if (!existing || separation < existing.distance) heteroPairs.set(key,{ residueEntry,hetero,type,distance:separation,groupKey });
  };
  heavy.forEach(residueEntry => {
    const cell = [Math.floor(residueEntry.atom.x/4.5),Math.floor(residueEntry.atom.y/4.5),Math.floor(residueEntry.atom.z/4.5)];
    for (let dx=-1;dx<=1;dx+=1) for (let dy=-1;dy<=1;dy+=1) for (let dz=-1;dz<=1;dz+=1) {
      (heteroCells.get(cellKey(cell[0]+dx,cell[1]+dy,cell[2]+dz)) || []).forEach(hetero => {
        const separation=distance(residueEntry.atom,hetero);
        if (separation > 4.5 || separation < 1.2) return;
        recordHetero(residueEntry,hetero,"ligand",separation);
        if (separation <= 3.6 && ["N","O","S"].includes(residueEntry.atom.element) && ["N","O","S"].includes(hetero.element)) recordHetero(residueEntry,hetero,"ligandPolar",separation);
        if (separation <= 3.0 && ["N","O","S"].includes(residueEntry.atom.element) && metalElements.has(hetero.element)) recordHetero(residueEntry,hetero,"metal",separation);
      });
    }
  });
  heteroPairs.forEach(entry => {
    const target=evidence.get(entry.residueEntry.residue.key); if (!target) return;
    const sidechain=atomIsSidechain(entry.residueEntry.atom);
    if (sidechain) target.ligandPartners.add(entry.groupKey); if (sidechain && entry.type === "metal") target.metalPartners.add(entry.groupKey);
    target.interactions.push({ type:entry.type, partnerKey:entry.groupKey, partnerLabel:`${entry.hetero.residue} ${entry.hetero.chain}:${entry.hetero.seq}`, distance:entry.distance, atom:entry.residueEntry.atom.atom, partnerAtom:entry.hetero.atom, sidechain, hetero:true, element:entry.hetero.element });
  });
  const typePriority={metal:0,disulfide:1,ionic:2,ligandPolar:3,polar:4,aromatic:5,hydrophobic:6,ligand:7,direct:8};
  evidence.forEach(target => target.interactions.sort((a,b) => (typePriority[a.type]??99)-(typePriority[b.type]??99) || a.distance-b.distance));
  return { evidence, typedResiduePairs:residuePairs.size, typedHeteroPairs:heteroPairs.size, heavyAtoms:heavy.length };
}
function mutationSuggestion(residue) {
  const substitutions = { ASP: "D→N", GLU: "E→Q", LYS: "K→Q", ARG: "R→Q", CYS: "C→S", ALA: "A→G", GLY: "G→A", PRO: "P→A" };
  return substitutions[residue?.name] || `${residue?.name || "Residue"}→Ala`;
}

function mutationLadder(residue) {
  const name = residue?.name || "Residue";
  const oneLetter = aminoAcidOneLetter[name] || name;
  const conservative = { ARG: "R→K", LYS: "K→R", ASP: "D→E", GLU: "E→D", ASN: "N→Q", GLN: "Q→N", SER: "S→T", THR: "T→S", PHE: "F→Y", TYR: "Y→F", TRP: "W→F", LEU: "L→I", ILE: "I→V", VAL: "V→I", MET: "M→L", CYS: "C→S", HIS: "H→N", ALA: "A→G", GLY: "G→A", PRO: "P→A" };
  const neutral = { ARG: "R→Q", LYS: "K→Q", ASP: "D→N", GLU: "E→Q", HIS: "H→A", SER: "S→A", THR: "T→A", ASN: "N→A", GLN: "Q→A", CYS: "C→A" };
  const stress = { ARG: "R→E", LYS: "K→E", ASP: "D→K", GLU: "E→K", HIS: "H→E", GLY: "G→P", PRO: "P→G" };
  return {
    conservative: conservative[name] || `${name}→similar residue`,
    neutral: neutral[name] || `${oneLetter}→A`,
    stress: residue?.disulfidePartner ? `${residue.disulfidePartner.label.replace("CYS ", "Cys ")}→Ser` : (stress[name] || `${oneLetter}→P`)
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

function buildMechanicalTargets(metrics) {
  const nuisance = new Set(["HOH","WAT","DOD","PO4","SO4","GOL","EDO","PEG","ACT","FMT","TRS","MES","HEP","CL","NA"]);
  const groups = new Map();
  metrics.forEach(residue => (residue.interactionEvidence || []).filter(row => row.hetero && row.distance <= 4.5).forEach(row => {
    if (!groups.has(row.partnerKey)) groups.set(row.partnerKey,{ id:`hetero:${row.partnerKey}`, type:"bound-group", label:`${row.partnerLabel} pocket`, residueKeys:new Set(), metal:false, nearest:Infinity });
    const group=groups.get(row.partnerKey); group.residueKeys.add(residue.key); group.metal ||= row.type === "metal" || metalElements.has(row.element); group.nearest=Math.min(group.nearest,row.distance);
  }));
  const interfaces = new Map();
  metrics.forEach(residue => (residue.interactionEvidence || []).filter(row => row.interchain && row.sidechain && row.type === "direct").forEach(row => {
    const partner=metrics.find(item=>item.key===row.partnerKey); if (!partner) return;
    const pair=[residue.chain,partner.chain].sort(); const id=`interface:${pair[0]}:${pair[1]}`;
    if(!interfaces.has(id))interfaces.set(id,{id,type:"interface",label:`Chains ${pair[0]}–${pair[1]} interface`,residueKeys:new Set(),contacts:0});
    interfaces.get(id).residueKeys.add(residue.key); interfaces.get(id).residueKeys.add(partner.key); interfaces.get(id).contacts+=1;
  }));
  const bound=[...groups.values()].filter(group=>group.residueKeys.size).sort((a,b)=>Number(b.metal)-Number(a.metal)+Number(nuisance.has(a.label.split(" ")[0]))-Number(nuisance.has(b.label.split(" ")[0]))||b.residueKeys.size-a.residueKeys.size||a.label.localeCompare(b.label));
  const chainInterfaces=[...interfaces.values()].filter(group=>group.residueKeys.size>=2).sort((a,b)=>b.contacts-a.contacts||a.label.localeCompare(b.label));
  const combinedByName=new Map();
  bound.forEach(group=>{const name=group.label.split(" ")[0];if(nuisance.has(name))return;if(!combinedByName.has(name))combinedByName.set(name,[]);combinedByName.get(name).push(group);});
  const combined=[...combinedByName.entries()].filter(([,items])=>items.length>1).map(([name,items])=>({id:`hetero-set:${name}`,type:"bound-group-set",label:`All ${name} pockets`,residueKeys:new Set(items.flatMap(item=>[...item.residueKeys])),metal:items.some(item=>item.metal),members:items.map(item=>item.id)})).sort((a,b)=>Number(b.metal)-Number(a.metal)||b.residueKeys.size-a.residueKeys.size);
  const targets=[...combined,...bound,...chainInterfaces].map(target=>({...target,residueKeys:[...target.residueKeys]}));
  if (!targets.length && metrics.length) {
    const anchor=[...metrics].sort((a,b)=>b.atomicPartners-a.atomicPartners||b.degree-a.degree)[0];
    const keys=metrics.filter(row=>distance(row.ca,anchor.ca)<=8.5).map(row=>row.key);
    targets.push({id:`anchor:${anchor.key}`,type:"exploratory",label:`Neighborhood around ${anchor.label}`,residueKeys:keys,note:"No bound group or chain interface was resolved; replace this exploratory anchor with residues from the known functional site."});
  }
  return targets;
}

function buildAnmOperator(metrics, cutoff) {
  const nodes=metrics, n=nodes.length, edges=[], diagonal=new Float64Array(3*n), cells=new Map(), cellKey=(x,y,z)=>`${x},${y},${z}`;
  nodes.forEach((node,i)=>{
    const cell=[Math.floor(node.ca.x/cutoff),Math.floor(node.ca.y/cutoff),Math.floor(node.ca.z/cutoff)];
    for(let dx=-1;dx<=1;dx+=1)for(let dy=-1;dy<=1;dy+=1)for(let dz=-1;dz<=1;dz+=1)(cells.get(cellKey(cell[0]+dx,cell[1]+dy,cell[2]+dz))||[]).forEach(j=>{
      const other=nodes[j],vx=node.ca.x-other.ca.x,vy=node.ca.y-other.ca.y,vz=node.ca.z-other.ca.z,d=Math.hypot(vx,vy,vz);
      if(d<1e-6||d>cutoff)return;
      const nx=vx/d,ny=vy/d,nz=vz/d; edges.push({i,j,nx,ny,nz});
      [nx,ny,nz].forEach((value,axis)=>{const term=value*value;diagonal[3*i+axis]+=term;diagonal[3*j+axis]+=term;});
    });
    const own=cellKey(...cell);if(!cells.has(own))cells.set(own,[]);cells.get(own).push(i);
  });
  const positive=[...diagonal].filter(value=>value>0), meanDiagonal=positive.reduce((sum,value)=>sum+value,0)/Math.max(positive.length,1), ridge=Math.max(1e-7,meanDiagonal*1e-3);
  const apply=input=>{
    const output=new Float64Array(input.length);
    edges.forEach(edge=>{const ix=3*edge.i,jx=3*edge.j,d=(input[ix]-input[jx])*edge.nx+(input[ix+1]-input[jx+1])*edge.ny+(input[ix+2]-input[jx+2])*edge.nz,fx=d*edge.nx,fy=d*edge.ny,fz=d*edge.nz;output[ix]+=fx;output[ix+1]+=fy;output[ix+2]+=fz;output[jx]-=fx;output[jx+1]-=fy;output[jx+2]-=fz;});
    for(let i=0;i<output.length;i+=1)output[i]+=ridge*input[i];
    return output;
  };
  return {nodes,edges,diagonal,ridge,apply,cutoff};
}

function dotProduct(a,b){let sum=0;for(let i=0;i<a.length;i+=1)sum+=a[i]*b[i];return sum;}

function solvePcg(operator,b,tolerance=1e-7,maxIterations=700){
  const n=b.length,x=new Float64Array(n),r=new Float64Array(b),z=new Float64Array(n),p=new Float64Array(n);
  for(let i=0;i<n;i+=1){z[i]=r[i]/(operator.diagonal[i]+operator.ridge);p[i]=z[i];}
  let rz=dotProduct(r,z),bNorm=Math.sqrt(Math.max(dotProduct(b,b),1e-30)),iterations=0,residual=Math.sqrt(Math.max(dotProduct(r,r),0))/bNorm;
  for(;iterations<maxIterations&&residual>tolerance;iterations+=1){
    const ap=operator.apply(p),denominator=dotProduct(p,ap);if(Math.abs(denominator)<1e-30)break;
    const alpha=rz/denominator;for(let i=0;i<n;i+=1){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];}
    residual=Math.sqrt(Math.max(dotProduct(r,r),0))/bNorm;if(residual<=tolerance)break;
    for(let i=0;i<n;i+=1)z[i]=r[i]/(operator.diagonal[i]+operator.ridge);
    const next=dotProduct(r,z),beta=next/Math.max(Math.abs(rz),1e-30);for(let i=0;i<n;i+=1)p[i]=z[i]+beta*p[i];rz=next;
  }
  return {x,iterations,residual};
}

function balancedTargetForce(nodeCount,targetIndices,axis){
  const force=new Float64Array(3*nodeCount),targetSet=new Set(targetIndices),targetWeight=1/Math.max(targetIndices.length,1),backgroundCount=Math.max(1,nodeCount-targetIndices.length),backgroundWeight=-1/backgroundCount;
  for(let i=0;i<nodeCount;i+=1)force[3*i+axis]=targetSet.has(i)?targetWeight:backgroundWeight;
  return force;
}

function deterministicProbe(length,seed){
  let state=(seed*2654435761)>>>0;const values=new Float64Array(length);
  for(let i=0;i<length;i+=1){state^=state<<13;state^=state>>>17;state^=state<<5;values[i]=(state>>>0)&1?1:-1;}
  for(let axis=0;axis<3;axis+=1){let mean=0;for(let i=axis;i<length;i+=3)mean+=values[i];mean/=length/3;for(let i=axis;i<length;i+=3)values[i]-=mean;}
  return values;
}

function calculateTargetResponse(metrics,target,cutoff,{estimateCompliance=false}={}){
  const fullNodeCount=metrics.length,targetRows=metrics.filter(row=>target.residueKeys.includes(row.key));
  if(!targetRows.length)return null;
  const targetDistanceByKey=metrics.length>1400?new Map(metrics.map(row=>[row.key,Math.min(...targetRows.map(targetRow=>distance(row.ca,targetRow.ca)))])):null;
  const modelMetrics=metrics.length>1400?[...metrics].sort((a,b)=>targetDistanceByKey.get(a.key)-targetDistanceByKey.get(b.key)).slice(0,1400):metrics;
  const operator=buildAnmOperator(modelMetrics,cutoff),indexByKey=new Map(modelMetrics.map((row,index)=>[row.key,index])),targetIndices=target.residueKeys.map(key=>indexByKey.get(key)).filter(Number.isInteger);
  if(!targetIndices.length)return null;
  const responses=[],solverRuns=[];
  for(let axis=0;axis<3;axis+=1){const force=balancedTargetForce(modelMetrics.length,targetIndices,axis),solution=solvePcg(operator,force);responses.push(solution.x);solverRuns.push(solution);}
  const targetCompliance=responses.reduce((sum,response,axis)=>sum+dotProduct(balancedTargetForce(modelMetrics.length,targetIndices,axis),response),0)/3;
  const localCompliance=new Float64Array(modelMetrics.length);
  if(estimateCompliance){
    const probeCount=8;
    for(let probe=1;probe<=probeCount;probe+=1){const vector=deterministicProbe(3*modelMetrics.length,probe),solution=solvePcg(operator,vector);solverRuns.push(solution);for(let i=0;i<modelMetrics.length;i+=1)for(let axis=0;axis<3;axis+=1)localCompliance[i]+=vector[3*i+axis]*solution.x[3*i+axis]/probeCount;}
  } else {
    for(let i=0;i<modelMetrics.length;i+=1)localCompliance[i]=3/(operator.diagonal[3*i]+operator.diagonal[3*i+1]+operator.diagonal[3*i+2]+3*operator.ridge);
  }
  const edgeLeverage=new Float64Array(modelMetrics.length);let totalEdgeLeverage=0;
  operator.edges.forEach(edge=>{let sensitivity=0;for(let forceAxis=0;forceAxis<3;forceAxis+=1){const response=responses[forceAxis],ix=3*edge.i,jx=3*edge.j,extension=(response[ix]-response[jx])*edge.nx+(response[ix+1]-response[jx+1])*edge.ny+(response[ix+2]-response[jx+2])*edge.nz;sensitivity+=extension*extension/3;}edgeLeverage[edge.i]+=sensitivity;edgeLeverage[edge.j]+=sensitivity;totalEdgeLeverage+=sensitivity;});
  const coupling=modelMetrics.map((row,i)=>{
    let crossSquared=0;for(let forceAxis=0;forceAxis<3;forceAxis+=1)for(let responseAxis=0;responseAxis<3;responseAxis+=1)crossSquared+=responses[forceAxis][3*i+responseAxis]**2;
    const local=Math.max(Math.abs(localCompliance[i]),1e-12),normalized=Math.sqrt(crossSquared)/Math.sqrt(Math.max(local*targetCompliance,1e-18));
    return {key:row.key,raw:Math.sqrt(crossSquared),normalized,localCompliance:local,leverage:edgeLeverage[i],leverageFraction:edgeLeverage[i]/Math.max(2*totalEdgeLeverage,1e-18)};
  });
  return {coupling,cutoff,edges:operator.edges.length,ridge:operator.ridge,targetCompliance,iterations:Math.max(...solverRuns.map(run=>run.iterations)),residual:Math.max(...solverRuns.map(run=>run.residual)),modelNodeCount:modelMetrics.length,fullNodeCount};
}

function mutationConstraintLeverage(residue){
  const forecast=mutationInteractionForecast(residue,mutationLadder(residue).conservative),changes=forecast.changes||[];
  if(!changes.length)return .18;
  const changed=changes.reduce((sum,row)=>sum+(row.retained===false?1:row.retained===true ? .2 : .65),0);
  return Math.max(.05,Math.min(1,changed/Math.max(changes.length,1)));
}

function applyMechanicalTarget(report,targetId=activeTargetId){
  const target=report.targetOptions.find(item=>item.id===targetId)||report.targetOptions[0];if(!target)return report;
  activeTargetId=target.id;report.activeTarget=target;
  const cutoffs=[8,8.5,9],profiles=cutoffs.map(cutoff=>calculateTargetResponse(report.residueMetrics,target,cutoff,{estimateCompliance:cutoff===8.5})).filter(Boolean),central=profiles.find(profile=>profile.cutoff===8.5)||profiles[0];
  if(!central)return report;
  const byCutoff=profiles.map(profile=>new Map(profile.coupling.map(row=>[row.key,row]))),centralMap=byCutoff[profiles.indexOf(central)],targetRows=report.residueMetrics.filter(row=>target.residueKeys.includes(row.key));
  report.mechanicalModel={cutoffs,profiles:profiles.map(({coupling,...rest})=>rest),targetResidues:targetRows.length};
  report.residueMetrics.forEach(row=>{
    row.label=row.authorLabel||row.label;row.constructRepresentative=true;row.equivalentAuthors=[row.authorLabel||row.label];
    const values=byCutoff.map(map=>map.get(row.key)?.leverage||0),mean=values.reduce((sum,value)=>sum+value,0)/values.length,variance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length;
    row.mechanicalModeled=centralMap.has(row.key);
    row.mechanicalCoupling=centralMap.get(row.key)?.normalized||0;
    row.mechanicalRaw=centralMap.get(row.key)?.raw||0;
    row.mechanicalLeverage=centralMap.get(row.key)?.leverage||0;
    row.mechanicalLeverageFraction=centralMap.get(row.key)?.leverageFraction||0;
    row.mechanicalByCutoff=profiles.map((profile,index)=>({cutoff:profile.cutoff,coupling:byCutoff[index].get(row.key)?.normalized||0,leverage:byCutoff[index].get(row.key)?.leverage||0}));
    row.mechanicalRobustness=row.mechanicalModeled?1/(1+Math.sqrt(variance)/Math.max(mean,1e-12)):0;
    row.mutationLeverage=mutationConstraintLeverage(row);
    row.targetDistance=Math.min(...targetRows.map(targetRow=>distance(row.ca,targetRow.ca)),Infinity);
    row.inTarget=target.residueKeys.includes(row.key);
  });
  const constructGroups=new Map();
  report.residueMetrics.forEach(row=>{if(!constructGroups.has(row.constructGroupKey))constructGroups.set(row.constructGroupKey,[]);constructGroups.get(row.constructGroupKey).push(row);});
  constructGroups.forEach(group=>{
    if(group.length<2)return;
    const representative=[...group].sort((a,b)=>b.mechanicalLeverage-a.mechanicalLeverage||a.chain.localeCompare(b.chain))[0],authors=group.map(row=>row.authorLabel),chains=[...new Set(group.map(row=>row.chain))],seqs=[...new Set(group.map(row=>`${row.seq}${row.insertion||""}`))];
    const summedByCutoff=profiles.map((profile,index)=>({cutoff:profile.cutoff,coupling:Math.max(...group.map(row=>row.mechanicalByCutoff[index]?.coupling||0)),leverage:group.reduce((sum,row)=>sum+(row.mechanicalByCutoff[index]?.leverage||0),0)}));
    const leverageValues=summedByCutoff.map(item=>item.leverage),leverageMean=mean(leverageValues),leverageVariance=mean(leverageValues.map(value=>(value-leverageMean)**2));
    representative.mechanicalLeverage=group.reduce((sum,row)=>sum+row.mechanicalLeverage,0);representative.mechanicalLeverageFraction=group.reduce((sum,row)=>sum+row.mechanicalLeverageFraction,0);representative.mechanicalCoupling=Math.max(...group.map(row=>row.mechanicalCoupling));representative.mechanicalByCutoff=summedByCutoff;representative.mechanicalRobustness=1/(1+Math.sqrt(leverageVariance)/Math.max(leverageMean,1e-18));representative.targetDistance=Math.min(...group.map(row=>row.targetDistance));representative.inTarget=group.some(row=>row.inTarget);representative.equivalentAuthors=authors;
    ["atomicPartners","polarContacts","ionicContacts","hydrophobicContacts","aromaticContacts","ligandAtomicContacts","metalContacts","degree","weighted","longRange","interchain","closeness","betweenness","burial","bMean","mutationLeverage"].forEach(feature=>{representative[feature]=mean(group.map(row=>row[feature]||0));});
    representative.directMetalCoordination=group.some(row=>row.directMetalCoordination);representative.disulfidePartner=group.find(row=>row.disulfidePartner)?.disulfidePartner||null;representative.interactionEvidence=group.flatMap(row=>row.interactionEvidence||[]);
    representative.label=seqs.length===1?`${representative.name} ${chains.join("/")}:${seqs[0]}`:`${representative.name} equivalent position ${representative.sequenceIndex} · ${authors.join(", ")}`;
    group.filter(row=>row!==representative).forEach(row=>{row.constructRepresentative=false;row.mechanicalModeled=false;row.mechanicalLeverage=0;row.mechanicalLeverageFraction=0;row.mechanicalRobustness=0;row.mechanicalPercentile=0;row.duplicateOf=representative.key;});
  });
  report.residueMetrics.forEach(row=>{row.mechanicalPercentile=0;});
  const sorted=report.residueMetrics.filter(row=>row.mechanicalModeled).sort((a,b)=>b.mechanicalLeverage-a.mechanicalLeverage);sorted.forEach((row,index)=>{row.mechanicalPercentile=sorted.length>1?(sorted.length-index-1)/(sorted.length-1):1;});
  return report;
}

function scoreResidues(metrics, lensName = "general") {
  const lens = scoreLenses[lensName] || scoreLenses.general;
  const maxima = {};
  const rankableMetrics=metrics.filter(row=>row.constructRepresentative!==false);
  ["degree","weighted","longRange","interchain","closeness","betweenness","atomicPartners","polarContacts","ionicContacts","ligandAtomicContacts"].forEach(feature => { maxima[feature] = Math.max(...rankableMetrics.map(row => row[feature] || 0), 1e-12); });
  const ranked = metrics.map(row => {
    const normalized = {
      mechanical:row.mechanicalPercentile || 0, robustness:row.mechanicalRobustness || 0, perturbation:row.mutationLeverage || 0,
      degree:(row.degree || 0) / maxima.degree, weighted:(row.weighted || 0) / maxima.weighted,
      longRange:(row.longRange || 0) / maxima.longRange, interchain:(row.interchain || 0) / maxima.interchain,
      closeness:(row.closeness || 0) / maxima.closeness, betweenness:(row.betweenness || 0) / maxima.betweenness,
      burial:row.burial || 0, ligand:row.ligandDistance === null ? 0 : Math.max(0, 1 - row.ligandDistance / 10), coordination:row.directMetalCoordination ? 1 : 0, cdr:row.cdrHeuristic ? 1 : 0,
      atomic:(row.atomicPartners || 0) / maxima.atomicPartners, polar:(row.polarContacts || 0) / maxima.polarContacts,
      ionic:(row.ionicContacts || 0) / maxima.ionicContacts, ligandAtomic:(row.ligandAtomicContacts || 0) / maxima.ligandAtomicContacts
    };
    const contributions = Object.fromEntries(Object.entries(lens.weights).map(([feature, weight]) => [feature, 100 * weight * (normalized[feature] || 0)]));
    let eligibility=1;
    if(row.constructRepresentative===false)eligibility=0;
    if(lensName==="general"&&(row.inTarget||row.targetDistance<6))eligibility=row.inTarget?0:.35;
    if(lensName==="allostery"&&(row.inTarget||row.targetDistance<10))eligibility=0;
    if(lensName==="ligand"&&row.targetDistance>7)eligibility=.35;
    const score = eligibility*Object.values(contributions).reduce((sum, value) => sum + value, 0);
    const signals = [];
    if(Number.isFinite(row.targetDistance)) signals.push(`${row.targetDistance.toFixed(1)} Å from the selected target; compliance-sensitivity percentile ${(100*(row.mechanicalPercentile||0)).toFixed(0)}; ${(100*(row.mechanicalRobustness||0)).toFixed(0)}/100 cutoff robustness`);
    if (row.directMetalCoordination) signals.push(`${row.ligandDistance.toFixed(1)} Å direct ${row.nearestLigandElement} coordination in ${row.nearestLigand}`);
    else if (row.ligandDistance !== null && row.ligandDistance <= 6) signals.push(`${row.ligandDistance.toFixed(1)} Å from ${row.nearestLigand || "a bound group"}`);
    if (row.atomicPartners) signals.push(`${row.atomicPartners} atom-level partner${row.atomicPartners === 1 ? "" : "s"}`);
    if (row.polarContacts) signals.push(`${row.polarContacts} polar-contact geometr${row.polarContacts === 1 ? "y" : "ies"}`);
    if (row.ionicContacts) signals.push(`${row.ionicContacts} ionic-contact geometr${row.ionicContacts === 1 ? "y" : "ies"}`);
    if (row.interchain) signals.push(`${row.interchain} cross-chain contact${row.interchain === 1 ? "" : "s"}`);
    if (row.longRange) signals.push(`${row.longRange} long-range contact${row.longRange === 1 ? "" : "s"}`);
    if (row.betweenness > 0) signals.push("shortest-path participation");
    if (row.cdrHeuristic) signals.push("antibody CDR-range heuristic");
    if (row.disulfidePartner) signals.push(`probable disulfide to ${row.disulfidePartner.label} (${row.disulfidePartner.distance.toFixed(2)} Å; no score bonus)`);
    if (row.burial >= .58) signals.push("buried structural context");
    if (!signals.length) signals.push("strongest available contact context");
    return { ...row, normalized, contributions, score, context:signals[0], rationale:`Target-directed response: ${signals.join("; ")}. The proposed substitution changes an estimated ${(100*(row.mutationLeverage||0)).toFixed(0)}% of the tracked local constraint capacity. Wider Cα graph: ${row.degree} non-local contacts.` };
  }).sort((a,b) => Number(b.constructRepresentative!==false)-Number(a.constructRepresentative!==false) || b.score - a.score || b.degree - a.degree || a.label.localeCompare(b.label));
  const rankable=ranked.filter(row=>row.constructRepresentative!==false);rankable.forEach((row,index)=>{row.rank=index+1;row.percentile=rankable.length>1?100*(rankable.length-index-1)/(rankable.length-1):100;});ranked.filter(row=>row.constructRepresentative===false).forEach(row=>{row.rank=null;row.percentile=0;});
  return ranked;
}

function pickMatchedControl(ranked, candidate, excluded = new Set()) {
  if (!candidate) return null;
  const contributionSum=(row,features)=>features.reduce((sum,feature)=>sum+(row.contributions?.[feature]||0),0);
  const candidateGraph=contributionSum(candidate,graphFeatureNames);
  const eligible=ranked.filter(row=>row.constructRepresentative!==false&&row.label!==candidate.label&&!excluded.has(row.label)&&row.mechanicalLeverage<candidate.mechanicalLeverage*.62&&!row.inTarget&&!row.disulfidePartner&&!(row.chain===candidate.chain&&Math.abs(row.sequenceIndex-candidate.sequenceIndex)<=3));
  const expanded=eligible.length>=3?eligible:ranked.filter(row=>row.constructRepresentative!==false&&row.label!==candidate.label&&!excluded.has(row.label)&&row.mechanicalLeverage<candidate.mechanicalLeverage*.82&&!row.inTarget&&!row.disulfidePartner),sameResidue=expanded.filter(row=>row.name===candidate.name),pool=sameResidue.length?sameResidue:expanded;
  const localPenalty = row => {
    const chemistry = row.name===candidate.name?0:row.residueClass === candidate.residueClass ? 1.2 : 2.4;
    const localDistance=localFeatureNames.reduce((sum,feature)=>sum+Math.abs((row.normalized?.[feature]||0)-(candidate.normalized?.[feature]||0)),0)/localFeatureNames.length;
    const quality=.7*Math.min(1,Math.abs((row.bMean||0)-(candidate.bMean||0))/40);
    const chain=row.chain===candidate.chain?0:.9;
    const disulfide=row.disulfidePartner?2:0;
    const burial=1.8*Math.abs((row.burial||0)-(candidate.burial||0));
    const contactMatch=.55*Math.abs((row.atomicPartners||0)-(candidate.atomicPartners||0))/Math.max(candidate.atomicPartners,1)+.35*Math.abs((row.polarContacts||0)-(candidate.polarContacts||0))/Math.max(candidate.polarContacts,1);
    return chemistry+2.1*localDistance+burial+contactMatch+quality+.35*chain+disulfide;
  };
  const selectionPenalty=row=>localPenalty(row)+.35*(row.mechanicalLeverage/Math.max(candidate.mechanicalLeverage,1e-18));
  const control = [...pool].sort((a,b) => selectionPenalty(a) - selectionPenalty(b))[0] || ranked.filter(row=>row.constructRepresentative!==false&&!excluded.has(row.label)).at(-1) || null;
  if (!control) return null;
  const quality = Math.max(0, Math.min(100, 100 - 18 * localPenalty(control)));
  const controlGraph=contributionSum(control,graphFeatureNames);
  const candidateLocal=contributionSum(candidate,localFeatureNames),controlLocal=contributionSum(control,localFeatureNames);
  const leverageRatio=control.mechanicalLeverage/Math.max(candidate.mechanicalLeverage,1e-18);
  return { ...control, matchQuality:quality, leverageRatio, graphContrast:candidateGraph-controlGraph, candidateGraphScore:candidateGraph, controlGraphScore:controlGraph, candidateLocalScore:candidateLocal, controlLocalScore:controlLocal, controlRationale:`Local-environment match ${quality.toFixed(0)}/100: ${control.name===candidate.name?"same wild-type residue and substitution":"nearest available residue chemistry"}; side-chain atomic partners ${control.atomicPartners} vs ${candidate.atomicPartners}; polar contacts ${control.polarContacts} vs ${candidate.polarContacts}; bound-group contacts ${control.ligandAtomicContacts} vs ${candidate.ligandAtomicContacts}; burial ${control.burial.toFixed(2)} vs ${candidate.burial.toFixed(2)}. In the same target-loaded network, the control has ${(100*leverageRatio).toFixed(0)}% of the candidate's first-order target-compliance sensitivity. If candidate and control behave alike, the mechanical-sensitivity hypothesis is not supported.` };
}

function rerankReport(report, lensName = activeScoringLens) {
  report.scoringLens = lensName;
  report.scoreWeights = { ...scoreLenses[lensName].weights };
  report.allResidues = scoreResidues(report.residueMetrics, lensName);
  report.rankableCount=report.allResidues.filter(row=>row.constructRepresentative!==false).length;
  report.topResidues = report.allResidues.filter(row=>row.constructRepresentative!==false).slice(0, 10);
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
  const typedInteractions=buildTypedInteractionEvidence(residues,heteroAtoms);
  const residueMetrics=residues.filter(row=>row.ca).map(row => {
    const nearestLigandAtom=row.atoms.slice(0,16).reduce((residueBest,residueAtom)=>heteroAtoms.slice(0,2000).reduce((best,atom)=>{const separation=distance(residueAtom,atom);return !best||separation<best.distance?{atom,distance:separation}:best;},residueBest),null);
    const typed=typedInteractions.evidence.get(row.key);
    return {
      key:row.key,label:`${row.name} ${row.chain}:${row.seq}${row.insertion}`,name:row.name,chain:row.chain,seq:row.seq,insertion:row.insertion,sequenceIndex:row.sequenceIndex,
      degree:degree.get(row.key),weighted:weighted.get(row.key),longRange:longRange.get(row.key),interchain:interchain.get(row.key),closeness:closeness.get(row.key),betweenness:betweennessResult.values.get(row.key)||0,
      burial:1-Math.min(1,distance(row.ca,centroid)/maxRadius),ligandDistance:nearestLigandAtom?.distance??null,nearestLigand:nearestLigandAtom?.atom?.residue??null,nearestLigandElement:nearestLigandAtom?.atom?.element??null,directMetalCoordination:Boolean(nearestLigandAtom&&metalElements.has(nearestLigandAtom.atom.element)&&nearestLigandAtom.distance<=3.0),
      atomicPartners:typed?.atomicPartners.size||0,polarContacts:typed?.polarPartners.size||0,ionicContacts:typed?.ionicPartners.size||0,hydrophobicContacts:typed?.hydrophobicPartners.size||0,aromaticContacts:typed?.aromaticPartners.size||0,ligandAtomicContacts:typed?.ligandPartners.size||0,metalContacts:typed?.metalPartners.size||0,interactionEvidence:typed?.interactions||[],
      bMean:row.atoms.length?row.atoms.reduce((sum,atom)=>sum+(Number.isFinite(atom.b)?atom.b:0),0)/row.atoms.length:null,residueClass:residueClass(row.name),disulfidePartner:disulfidePartners.get(row.key)||null,cdrHeuristic:row.cdrHeuristic,ca:{x:row.ca.x,y:row.ca.y,z:row.ca.z}
    };
  });
  const sequenceGroupByChain=new Map();
  const sequenceGroups=new Map();
  chainReports.forEach(chain=>{if(!sequenceGroups.has(chain.sequence))sequenceGroups.set(chain.sequence,[]);sequenceGroups.get(chain.sequence).push(chain.chain);});
  [...sequenceGroups.values()].forEach((group,index)=>group.forEach(chain=>sequenceGroupByChain.set(chain,`sequence-group-${index+1}`)));
  residueMetrics.forEach(row=>{row.authorLabel=row.label;row.chainCopies=sequenceGroups.get(chainReports.find(chain=>chain.chain===row.chain)?.sequence)||[row.chain];row.constructGroupKey=`${sequenceGroupByChain.get(row.chain)||row.chain}:${row.sequenceIndex}:${row.name}`;});
  const report={ residues:residues.length,polymerAtoms:polymerAtoms.length,chainReports,contacts:edges.length,alternateCount,lowOccupancy,missingCa,disulfides:Math.floor(disulfidePartners.size/2),waters:waters.length,
    hetero:[...hetero.values()].map(group=>`${group.name} ${group.chain}:${group.seq}`),metals:metals.map(group=>`${group.name} ${group.chain}:${group.seq}`),bMean:bValues.length?bValues.reduce((sum,value)=>sum+value,0)/bValues.length:null,bMedian:median(bValues),
    residueMetrics,edges,models,metadata,format,contactCutoff,betweennessCalculated:betweennessResult.calculated,antibodyContext,antibodyChains:[...antibodyChains],
    typedInteractionPairs:typedInteractions.typedResiduePairs,typedHeteroPairs:typedInteractions.typedHeteroPairs,typedHeavyAtoms:typedInteractions.heavyAtoms
  };
  report.targetOptions=buildMechanicalTargets(residueMetrics);
  applyMechanicalTarget(report,activeTargetId);
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
      useNote: "Measure oxygen affinity or cooperativity together with heme occupancy and tetramer integrity.",
      assay: "an oxygen-equilibrium or spectral heme assay",
      purpose: "The structure is suited to separating heme-proximal effects from subunit communication and general fold loss.",
    },
    {
      match: /antibody|immunoglobulin|immune|antigen/,
      identity: "Immune recognition protein",
      useCase: "Binding and specificity",
      useNote: "Measure binding or neutralization together with expression and scaffold integrity.",
      assay: "the established binding or neutralization assay",
      purpose: "The most useful question is whether a surface intervention changes recognition beyond a matched structural perturbation.",
    },
    {
      match: /receptor|signaling|signal transduction|g-protein|kinase|phosphatase/,
      identity: "Signaling protein",
      useCase: "Activity and state control",
      useNote: "Measure the established activity readout together with abundance and state or assembly controls.",
      assay: "the closest established activity or signaling readout",
      purpose: "The structure can identify a perturbation that tests state or partner control while preserving molecular integrity.",
    },
    {
      match: /enzyme|oxidoreductase|transferase|hydrolase|lyase|isomerase|ligase|protease|catalytic|\w+ase\b/,
      identity: "Catalytic protein",
      useCase: "Catalysis and substrate handling",
      useNote: "Measure turnover or product formation together with abundance and fold quality.",
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
  const siteReason = candidate
    ? `${candidate.label} is ${candidate.targetDistance.toFixed(1)} Å from ${report.activeTarget?.label||"the selected target"}, at target-compliance-sensitivity percentile ${(100*(candidate.mechanicalPercentile||0)).toFixed(0)} with ${(100*(candidate.mechanicalRobustness||0)).toFixed(0)}/100 cutoff robustness.${candidate.directMetalCoordination?` It also makes a ${candidate.ligandDistance.toFixed(1)} Å direct ${candidate.nearestLigandElement} contact.`:candidate.interchain?` It has ${candidate.interchain} cross-chain contact${candidate.interchain===1?"":"s"}.`:candidate.ligandDistance!==null&&candidate.ligandDistance<=6?` It is ${candidate.ligandDistance.toFixed(1)} Å from ${candidate.nearestLigand||"a bound group"}.`:""}`
    : "No rankable residue was resolved.";
  return {
    ...category,
    identityNote,
    siteReason,
    firstMove: `${mutation} at ${candidate?.label || "the first ranked site"}`,
    experiment: `Build ${mutation} and the equivalent perturbation at ${control?.label || "a matched lower-contact site"}. Run both beside wild type. Measure ${category.assay}, then abundance and one folding or stability readout in the same batch.`,
  };
}

function assayFor(report, residue, control = null) {
  return customAssay || biologicalGuidance(report, residue, control).assay;
}

function experimentConstructs(report, residue) {
  const control = matchedControlForResidue(report, residue);
  const candidate = mutationLadder(residue);
  const comparison = control ? mutationLadder(control) : null;
  return [
    { construct: "Wild type", site: "—", substitution: "—", purpose: "same-batch baseline" },
    { construct: "Candidate first probe", site: residue.label, substitution: candidate.conservative, purpose: "least severe interpretable change" },
    { construct: "Candidate stronger probe", site: residue.label, substitution: candidate.neutral, purpose: "removes more of the original side-chain chemistry" },
    control
      ? { construct: "Matched structural control", site: control.label, substitution: comparison.conservative, purpose: `controls for chemistry and structural context; match ${control.matchQuality.toFixed(0)}/100` }
      : { construct: "Matched structural control", site: "not available", substitution: "choose manually", purpose: "no credible automatic match in this coordinate record" }
  ];
}

function updateAssaySetup(report, residue) {
  const control = matchedControlForResidue(report, residue);
  const suggestion = biologicalGuidance(report, residue, control).assay;
  const input = document.getElementById("assayInput");
  const feedback = document.getElementById("assayFeedback");
  if (input && document.activeElement !== input) input.value = customAssay || suggestion;
  if (!feedback) return;
  feedback.textContent = customAssay
    ? `Using your readout: ${customAssay}. The experiment sheet and decision rule below have updated; residue scores are unchanged.`
    : `Using RINet suggestion: ${suggestion}. Replace it if your laboratory uses a more specific assay.`;
  feedback.classList.toggle("applied", Boolean(customAssay));
}

function bounded(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function structuralVector(residue) {
  const n = residue?.normalized || {};
  return [n.mechanical,n.robustness,n.perturbation,n.degree,n.weighted,n.longRange,n.interchain,n.burial,n.ligand,n.coordination,n.cdr,n.atomic,n.polar,n.ionic,n.ligandAtomic].map(value => bounded(value));
}

function vectorDistance(left, right) {
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - (right[index] || 0)) ** 2, 0));
}

function adaptiveControlFor(report, candidate, excluded = new Set()) {
  return pickMatchedControl(report.allResidues,candidate,excluded);
}

function buildAdaptivePanel(report, requestedSize = adaptiveRound.panelSize) {
  const panelSize = [6,8,12].includes(Number(requestedSize)) ? Number(requestedSize) : 8;
  adaptiveRound.panelSize = panelSize;
  const pairTarget = panelSize === 6 ? 2 : panelSize === 8 ? 3 : 5;
  const candidateTarget = Math.min(pairTarget,Math.floor((panelSize-1)/2));
  const eligible=report.allResidues.filter(row=>!row.disulfidePartner&&!row.inTarget&&row.score>0);
  const pool = eligible.slice(0, Math.min(180, eligible.length));
  const selected = [pool[0]||report.topResidues[0]].filter(Boolean);
  while (selected.length < candidateTarget) {
    const selectedVectors = selected.map(structuralVector);
    const remaining = pool.filter(row => !selected.some(item => item.label === row.label));
    const choice = remaining.map(row => {
      const diversity = Math.min(...selectedVectors.map(vector => vectorDistance(structuralVector(row), vector))) / Math.sqrt(15);
      const distanceDiversity=Math.min(...selected.map(item=>Math.abs(row.targetDistance-item.targetDistance)))/30;
      return { row, score:.52*(row.mechanicalPercentile||0)+.18*(row.mechanicalRobustness||0)+.18*bounded(diversity)+.12*bounded(distanceDiversity) };
    }).sort((a,b)=>b.score-a.score || a.row.rank-b.row.rank)[0]?.row;
    if (!choice) break;
    selected.push(choice);
  }
  const excluded = new Set(selected.map(row=>row.label));
  const controls = [];
  selected.forEach(candidate => {
    const control = adaptiveControlFor(report,candidate,excluded);
    if (control) { excluded.add(control.label); controls.push({ residue:control, candidate }); }
  });
  const entries = [{ type:"wt", key:"WT", role:"WT reference", residue:null, mutation:"—", why:"Same-batch normalization for every assay channel." }];
  selected.forEach(residue => {
    entries.push({ type:"candidate", key:residue.label, role:"High-leverage candidate", residue, mutation:mutationLadder(residue).conservative, why:`Target-compliance-sensitivity percentile ${(100*(residue.mechanicalPercentile||0)).toFixed(0)} for ${report.activeTarget.label}; ${residue.targetDistance.toFixed(1)} Å from the target; ${(100*(residue.mechanicalRobustness||0)).toFixed(0)}/100 cutoff robustness.` });
    const pair = controls.find(item => item.candidate.label === residue.label);
    if (pair) entries.push({ type:"control", key:pair.residue.label, role:"Matched low-leverage control", residue:pair.residue, mutation:mutationLadder(pair.residue).conservative, candidateFor:residue, why:`Local match ${pair.residue.matchQuality.toFixed(0)}/100 to ${residue.label}; retains ${(100*pair.residue.leverageRatio).toFixed(0)}% of its target-compliance sensitivity. This is the falsification control.` });
  });
  while(entries.length<panelSize){const extra=pool.find(row=>!entries.some(entry=>entry.residue?.label===row.label));if(!extra)break;entries.push({type:"candidate",key:extra.label,role:"Independent high-sensitivity site",residue:extra,mutation:mutationLadder(extra).conservative,why:`Adds an independent high-sensitivity site at ${extra.targetDistance.toFixed(1)} Å to test whether the target response repeats beyond one residue.`});}
  adaptiveRound.panel = entries.slice(0,panelSize);
  return adaptiveRound.panel;
}

function resetAdaptiveAnalysisUI() {
  const status = document.getElementById("adaptiveStatus");
  if (status) {
    status.className="adaptive-status";
    status.innerHTML="<strong>Panel generated.</strong><span>Enter normalized measurements in the table, or export and re-import the CSV template.</span>";
  }
  const summary = document.getElementById("adaptivePosteriorSummary");
  if (summary) summary.textContent="Complete function, abundance and fold/assembly for at least two candidates and one of their matched controls.";
  const posterior = document.getElementById("adaptivePosterior");
  if (posterior) posterior.innerHTML="<span>No measurements entered</span>";
  const nextRows = document.getElementById("adaptiveNextRows");
  if (nextRows) nextRows.innerHTML="<p>Follow-up sites will appear here after the result table is analyzed.</p>";
  const interpretation = document.getElementById("workflowInterpretation");
  if (interpretation) interpretation.textContent="Awaiting measurements";
  const next = document.getElementById("workflowNext");
  if (next) next.textContent="Available after round 1";
}

function adaptiveResultClass(result) {
  if (!result || ![result.function,result.abundance,result.integrity].every(Number.isFinite)) return { label:"Awaiting result", className:"" };
  const functionalThreshold = bounded(document.getElementById("adaptiveFunctionThreshold")?.value || 20,1,100);
  const integrityFloor = bounded(document.getElementById("adaptiveIntegrityFloor")?.value || 75,1,100);
  const shifted = Math.abs(result.function-100) >= functionalThreshold;
  const intact = result.abundance >= integrityFloor && result.integrity >= integrityFloor;
  if (shifted && intact) return { label:"Specific functional effect", className:"signal" };
  if (shifted && !intact) return { label:"Confounded by protein quality", className:"confound" };
  if (!shifted && intact) return { label:"No resolved effect", className:"negative" };
  return { label:"Protein-quality defect", className:"confound" };
}

function renderAdaptivePanel(report, { rebuild = true, clearResults = false } = {}) {
  if (!report || !document.getElementById("adaptivePanelRows")) return;
  if (clearResults) { adaptiveRound.results.clear(); adaptiveRound.example=false; resetAdaptiveAnalysisUI(); }
  if (rebuild || !adaptiveRound.panel.length) buildAdaptivePanel(report,document.getElementById("adaptivePanelSize")?.value || adaptiveRound.panelSize);
  const body = document.getElementById("adaptivePanelRows");
  body.innerHTML = adaptiveRound.panel.map((entry,index) => {
    const result = adaptiveRound.results.get(entry.key) || {};
    const interpretation = adaptiveResultClass(result);
    const position = `A${index+1}`;
    const site = entry.residue ? `<button type="button" class="adaptive-site-button" data-adaptive-site="${esc(entry.residue.label)}">${esc(entry.residue.label)}<small>${esc(entry.mutation)}</small></button>` : `<strong>Wild type</strong><small>reference</small>`;
    const field = (name,value) => `<input class="adaptive-result-input" type="number" min="0" max="300" step="1" ${entry.type==="wt"?"disabled value=\"100\"":`data-adaptive-key="${esc(encodeURIComponent(entry.key))}" data-adaptive-field="${name}" value="${Number.isFinite(value)?value:""}"`} aria-label="${esc(`${entry.key} ${name} percent wild type`)}">`;
    return `<tr><td>${position}</td><td>${esc(entry.role)}</td><td>${site}</td><td>${esc(entry.why)}</td><td>${field("function",result.function)}</td><td>${field("abundance",result.abundance)}</td><td>${field("integrity",result.integrity)}</td><td><span class="round-interpretation ${interpretation.className}">${interpretation.label}</span></td></tr>`;
  }).join("");
  body.querySelectorAll("[data-adaptive-site]").forEach(button=>button.addEventListener("click",()=>selectAnalyzedResidue(report.allResidues.find(row=>row.label===button.dataset.adaptiveSite),{autoView:true})));
  body.querySelectorAll("[data-adaptive-field]").forEach(input=>input.addEventListener("input",()=>{
    const key=decodeURIComponent(input.dataset.adaptiveKey); const result=adaptiveRound.results.get(key)||{}; const value=Number(input.value); result[input.dataset.adaptiveField]=Number.isFinite(value)&&input.value!==""?value:NaN; adaptiveRound.results.set(key,result);
  }));
  const candidates=adaptiveRound.panel.filter(entry=>entry.type==="candidate"&&entry.residue).map(entry=>entry.residue),controls=adaptiveRound.panel.filter(entry=>entry.type==="control");
  const distances=candidates.map(row=>row.targetDistance).filter(Number.isFinite),distanceSpan=distances.length>1?Math.max(...distances)-Math.min(...distances):0;
  const robustness=100*mean(candidates.map(row=>row.mechanicalRobustness||0));
  const couplingContrast=100*mean(controls.map(entry=>1-(entry.residue.leverageRatio||0)));
  document.getElementById("adaptiveCoverage").textContent=`${distanceSpan.toFixed(1)} Å`;
  document.getElementById("adaptiveBaseline").textContent=`${robustness.toFixed(0)}/100`;
  document.getElementById("adaptiveSeparation").textContent=`${couplingContrast.toFixed(0)}%`;
  document.getElementById("adaptiveControls").textContent=String(controls.length);
  document.getElementById("adaptivePanelSize").value=String(adaptiveRound.panelSize);
}

function adaptivePosteriorAnalysis(report) {
  const completed = new Map(adaptiveRound.panel.filter(entry=>entry.residue).map(entry=>[entry.key,adaptiveRound.results.get(entry.key)]).filter(([,result])=>[result?.function,result?.abundance,result?.integrity].every(Number.isFinite)));
  const measured = adaptiveRound.panel.filter(entry=>entry.type==="candidate"&&completed.has(entry.key)).map(entry=>{
    const controlEntry=adaptiveRound.panel.find(row=>row.type==="control"&&row.candidateFor?.label===entry.residue.label&&completed.has(row.key));
    return { entry, result:completed.get(entry.key), controlEntry, controlResult:controlEntry?completed.get(controlEntry.key):null };
  });
  if (completed.size < 3 || measured.length < 2) return null;
  const functionalThreshold=bounded(document.getElementById("adaptiveFunctionThreshold")?.value||20,1,100),integrityFloor=bounded(document.getElementById("adaptiveIntegrityFloor")?.value||75,1,100);
  const pairs=measured.map(row=>{
    const candidateEffect=Math.abs(row.result.function-100),controlEffect=row.controlResult?Math.abs(row.controlResult.function-100):0,specificContrast=candidateEffect-controlEffect,quality=Math.min(row.result.abundance,row.result.integrity),controlQuality=row.controlResult?Math.min(row.controlResult.abundance,row.controlResult.integrity):100;
    const classification=!row.controlResult?"unpaired":quality<integrityFloor?"confounded":specificContrast>=functionalThreshold&&controlQuality>=integrityFloor?"supported":"not-supported";
    return {...row,candidateEffect,controlEffect,specificContrast,quality,controlQuality,classification};
  });
  if(!pairs.some(row=>row.controlEntry))return null;
  const tested=new Set(adaptiveRound.panel.filter(entry=>entry.residue).map(entry=>entry.residue.label));
  const completedPairs=pairs.filter(row=>row.controlEntry),supported=completedPairs.filter(row=>row.classification==="supported"),confounded=completedPairs.filter(row=>row.classification==="confounded"),next=[];
  supported.slice(0,2).forEach(row=>next.push({residue:row.entry.residue,mutation:mutationLadder(row.entry.residue).neutral,reason:`The first probe produced a ${row.specificContrast.toFixed(0)}-point candidate-minus-control functional contrast with protein quality retained. A stronger substitution tests dose dependence at the same site.`,kind:"severity series"}));
  const pool=report.allResidues.filter(row=>!tested.has(row.label)&&!row.disulfidePartner&&!row.inTarget&&row.score>0).sort((a,b)=>b.score-a.score);
  if(next.length<4&&pool[0])next.push({residue:pool[0],mutation:mutationLadder(pool[0]).conservative,reason:supported.length?`Independent high-sensitivity site for replication of the target response; ${(100*pool[0].mechanicalRobustness).toFixed(0)}/100 cutoff robustness.`:confounded.length?`The first sites were limited by protein quality. This site retains high target-compliance sensitivity with a different local environment and may give a cleaner perturbation.`:`No completed pair cleared the candidate-minus-control threshold. Test the next high-sensitivity site before rejecting the target response.`,kind:"independent site"});
  if(next.length<4&&pool[1])next.push({residue:pool[1],mutation:mutationLadder(pool[1]).conservative,reason:`Samples a second untested high-sensitivity residue at ${pool[1].targetDistance.toFixed(1)} Å from the same target.`,kind:"replication site"});
  return { measured, completed, pairs, completedPairs, supported, confounded, next:next.slice(0,4),functionalThreshold,integrityFloor };
}

function analyzeAdaptiveResults(report=current?.report) {
  if (!report) return;
  document.querySelectorAll("[data-adaptive-field]").forEach(input=>{
    const key=decodeURIComponent(input.dataset.adaptiveKey); const result=adaptiveRound.results.get(key)||{}; const value=Number(input.value); result[input.dataset.adaptiveField]=Number.isFinite(value)&&input.value!==""?value:NaN; adaptiveRound.results.set(key,result);
  });
  const analysis=adaptivePosteriorAnalysis(report);
  renderAdaptivePanel(report,{rebuild:false});
  const status=document.getElementById("adaptiveStatus");
  if (!analysis) {
    status.className="adaptive-status"; status.innerHTML="<strong>Insufficient results.</strong><span>Complete all three measurements for at least two candidates and at least one of their matched controls.</span>";
    const interpretation=document.getElementById("workflowInterpretation");
    if(interpretation)interpretation.textContent="More complete measurements required";
    return;
  }
  status.className=`adaptive-status ${adaptiveRound.example?"example":""}`;
  const paired=analysis.completedPairs.length;
  status.innerHTML=adaptiveRound.example?"<strong>Synthetic example values loaded.</strong><span>These are for interface demonstration only; they are not measured 4HHB data.</span>":`<strong>${analysis.completed.size} constructs interpreted.</strong><span>The comparison used ${paired} complete candidate-control pair${paired===1?"":"s"}.</span>`;
  document.getElementById("adaptivePosteriorSummary").textContent=`${analysis.supported.length} of ${analysis.completedPairs.length} completed candidate-control pairs cleared the ${analysis.functionalThreshold}-point functional-contrast threshold while protein quantity and fold/assembly remained at or above ${analysis.integrityFloor}% WT. ${analysis.confounded.length} pair${analysis.confounded.length===1?" was":"s were"} limited by protein quality.`;
  document.getElementById("adaptivePosterior").innerHTML=analysis.pairs.map(row=>{const label=row.classification==="supported"?"mechanical-sensitivity contrast supported":row.classification==="confounded"?"protein-quality confound":row.classification==="unpaired"?"no completed paired control":"contrast not resolved";const width=Math.max(0,Math.min(100,Math.abs(row.specificContrast)));return `<div class="posterior-row"><span>${esc(row.entry.residue.label)} · ${esc(label)}</span><i><b style="width:${width.toFixed(1)}%"></b></i><strong>${row.classification==="unpaired"?"—":`${row.specificContrast>=0?"+":""}${row.specificContrast.toFixed(0)} pts`}</strong></div>`;}).join("");
  document.getElementById("adaptiveNextRows").innerHTML=analysis.next.map(({residue,mutation,reason,kind})=>`<div class="next-experiment-row"><button type="button" data-next-site="${esc(residue.label)}">${esc(residue.label)}<br>${esc(mutation)}</button><span>${esc(reason)}</span><strong>${esc(kind)}</strong></div>`).join("");
  const interpretation=document.getElementById("workflowInterpretation");
  if(interpretation)interpretation.textContent=analysis.supported.length?`${analysis.supported.length} paired target-response contrast${analysis.supported.length===1?"":"s"} supported`:analysis.confounded.length?"Results confounded by protein quality":"No paired target-response contrast resolved";
  const next=document.getElementById("workflowNext");
  if(next)next.textContent=analysis.next[0]?`${analysis.next[0].residue.label} ${analysis.next[0].mutation}`:"No follow-up site available";
  document.querySelectorAll("[data-next-site]").forEach(button=>button.addEventListener("click",()=>selectAnalyzedResidue(report.allResidues.find(row=>row.label===button.dataset.nextSite),{autoView:true})));
}

function loadAdaptiveExample(report=current?.report) {
  if (!report) return;
  adaptiveRound.results.clear();
  let candidateIndex=0,controlIndex=0;
  adaptiveRound.panel.filter(entry=>entry.residue).forEach(entry=>{let values;if(entry.type==="control"){values=controlIndex++===0?[97,96,94]:[96,97,96];}else{values=candidateIndex===0?[55,96,93]:candidateIndex===1?[68,61,58]:candidateIndex===2?[101,98,97]:[86,94,92];candidateIndex+=1;}adaptiveRound.results.set(entry.key,{function:values[0],abundance:values[1],integrity:values[2]});});
  adaptiveRound.example=true;
  renderAdaptivePanel(report,{rebuild:false});
  analyzeAdaptiveResults(report);
}

function fillBuiltInDemoResults(report=current?.report) {
  const builtIn = current?.sourceType === "built-in-demo";
  document.getElementById("adaptiveDemoNote")?.classList.toggle("hidden", !builtIn);
  const exampleButton = document.getElementById("loadAdaptiveExample");
  if (exampleButton) exampleButton.textContent = builtIn ? "Reload synthetic demo results" : "Fill clearly labeled example data";
  if (builtIn && report) loadAdaptiveExample(report);
}

function adaptiveCsvCell(value) {
  return `"${String(value??"").replaceAll('"','""')}"`;
}

function downloadAdaptiveTemplate() {
  if (!current) return;
  const residue=currentEvidenceResidue()||current.report.topResidues[0];
  const assay=assayFor(current.report,residue,matchedControlForResidue(current.report,residue));
  const header=["construct","role","residue","mutation","primary_assay","function_percent_wt","abundance_percent_wt","integrity_percent_wt","notes"];
  const rows=adaptiveRound.panel.map((entry,index)=>[ `A${index+1}`,entry.role,entry.residue?.label||"WT",entry.mutation,assay,entry.type==="wt"?100:"",entry.type==="wt"?100:"",entry.type==="wt"?100:"",entry.why ]);
  const csv=[header.map(adaptiveCsvCell).join(","),...rows.map(row=>row.map(adaptiveCsvCell).join(","))].join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); const link=document.createElement("a"); link.href=url; link.download=`rinet-${(current.report.metadata?.pdbId||"structure").toLowerCase()}-adaptive-round.csv`; link.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.getElementById("adaptiveStatus").innerHTML="<strong>Result template downloaded.</strong><span>Fill the three % WT columns and import the completed file.</span>";
}

function parseAdaptiveCsvLine(line) {
  const cells=[]; let value="", quoted=false;
  for(let index=0;index<line.length;index+=1){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){value+='"';index+=1;}else quoted=!quoted;}else if(char===","&&!quoted){cells.push(value);value="";}else value+=char;} cells.push(value); return cells;
}

async function importAdaptiveResults(file) {
  if (!file||!current) return;
  const lines=(await file.text()).replace(/\r/g,"").split("\n").filter(Boolean); if(lines.length<2)return;
  const headers=parseAdaptiveCsvLine(lines[0]).map(value=>value.trim().toLowerCase()); const index=Object.fromEntries(headers.map((value,i)=>[value,i])); let imported=0;
  const readNumber=value=>String(value??"").trim()===""?NaN:Number(value);
  lines.slice(1).forEach(line=>{const cells=parseAdaptiveCsvLine(line);const label=(cells[index.residue]||"").trim();if(!label||label==="WT")return;const entry=adaptiveRound.panel.find(row=>row.residue?.label===label);if(!entry)return;const result={function:readNumber(cells[index.function_percent_wt]),abundance:readNumber(cells[index.abundance_percent_wt]),integrity:readNumber(cells[index.integrity_percent_wt])};if([result.function,result.abundance,result.integrity].every(Number.isFinite)){adaptiveRound.results.set(entry.key,result);imported+=1;}});
  adaptiveRound.example=false; renderAdaptivePanel(current.report,{rebuild:false}); analyzeAdaptiveResults(current.report); if(imported<3)document.getElementById("adaptiveStatus").innerHTML=`<strong>${imported} complete rows imported.</strong><span>Analysis requires two measured candidates and one additional complete construct.</span>`;
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
    customAssay = "";
    adaptiveRound.panelSize = 8;
    adaptiveRound.panel = [];
    adaptiveRound.results.clear();
    adaptiveRound.example = false;
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
  const assay = assayFor(report, candidate, control);
  const candidateLabel = candidate?.label || "the first ranked site";
  const controlLabel = control?.label || "a matched lower-contact site";
  const firstChange = mutationLadder(candidate).conservative;
  const isOxygenAssembly = /oxygen|hemoglobin|haemoglobin|heme assembly/i.test(`${biology.identity} ${biology.useCase} ${report.metadata?.title || ""} ${report.metadata?.compound || ""}`);
  const generic = {
    biology: {
      title: "Structure–function test",
      thesis: `Compare ${candidateLabel} with ${controlLabel} using a protein-specific functional readout.`,
      opportunity: `Test whether the mutation at ${candidateLabel} produces a larger functional effect than the matched lower-score residue ${controlLabel}.`,
      program: `Test ${firstChange}, a matched perturbation at ${controlLabel}, and wild type. Measure integrity first, then ${assay}.`,
      question: `Does the candidate change the protein-specific output more than structural background while molecular integrity remains intact?`
    },
    engineering: {
      title: "Protein engineering screen",
      thesis: `Test a graded mutation series at ${candidateLabel} and remove constructs that lose expression or fold.`,
      opportunity: `Compare conservative, neutralizing and stronger mutations at ${candidateLabel}, using ${controlLabel} as the structural control.`,
      program: `Build a three-step chemistry ladder at ${candidateLabel}. Screen abundance and folding, then advance only intact constructs into ${assay}.`,
      question: "Can the response be shifted in a graded way without losing expression, assembly or fold quality?"
    },
    translation: {
      title: "Variant classification",
      thesis: "Classify each effect as functional, expression-related, folding-related, or unresolved.",
      opportunity: `Use the candidate and matched control to classify a variant by function, abundance and fold rather than by one score.`,
      program: `Measure abundance, one orthogonal integrity readout and ${assay} in the same batch. Keep conclusions at the protein level unless clinical evidence is supplied.`,
      question: "Which measurement cleanly distinguishes a functional effect from reduced expression, misfolding or failed assembly?"
    },
    mechanism: {
      title: "Mechanism test",
      thesis: `Use ${candidateLabel} to distinguish local packing, ligand coupling, assembly effects and site-specific functional control.`,
      opportunity: `Compare ${candidateLabel}, ${controlLabel} and the next ranked site across a shared integrity and function panel.`,
      program: `Predefine predictions for local packing, fold loss and site-specific function. Use ${assay} only after the integrity gate passes.`,
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
  const assay = assayFor(report, candidate, control);
  const structuralThesis = disulfide
    ? `${candidateLabel} forms a ${disulfide.distance.toFixed(2)} Å sulfur–sulfur contact with ${disulfide.label}, consistent with a disulfide constraint. The decisive question is whether function changes beyond any loss of structural integrity.`
    : `${candidateLabel} is rank ${candidate.rank}/${report.rankableCount||report.allResidues.length} under the active score. Compare it with ${controlLabel} and measure protein quality alongside function.`;

  document.getElementById("guidanceIdentity").textContent = biology.identity;
  document.getElementById("guidanceIdentityNote").textContent = biology.identityNote;
  document.getElementById("guidanceUseCase").textContent = biology.useCase;
  document.getElementById("guidanceUseCaseNote").textContent = biology.useNote;
  document.getElementById("guidancePrimaryReason").textContent = biology.siteReason;
  document.getElementById("guidanceMutation").textContent = biology.firstMove;
  document.getElementById("guidanceGate").textContent = disulfide ? "Measure protein quality first" : "Function effect exceeds control";
  document.getElementById("guidanceConfidence").textContent = `${Math.round(completeness * 100)}% coordinate completeness, not biological certainty.`;
  document.getElementById("guidanceHypothesis").textContent = selectedExperimentQuestion(report, candidate);
  document.getElementById("guidanceExperiment").textContent = `Build the first and stronger chemistry probes at ${candidateLabel}, plus the matched perturbation at ${controlLabel}. Run all constructs beside wild type. Measure ${assay}, abundance, and one orthogonal folding or stability readout in the same batch.`;
  document.getElementById("guidanceAdvance").textContent = `Advance the hypothesis if the ${candidateLabel} perturbation changes the biological readout more than ${controlLabel}, while expression and folding remain acceptably similar to wild type.`;
  document.getElementById("guidanceStop").textContent = `Do not interpret the site as specifically informative if candidate and comparison behave similarly, or if the candidate mainly lowers expression or disrupts folding. In that case, test ${runnerUp?.label || "the next-ranked residue"} or revise the assay.`;
  document.getElementById("mutationConservative").textContent = ladder.conservative;
  document.getElementById("mutationNeutral").textContent = ladder.neutral;
  document.getElementById("mutationStress").textContent = ladder.stress;
  document.getElementById("guidanceIntegrity").textContent = `For ${candidateLabel}, quantify expression or abundance and add one orthogonal folding/stability readout before interpreting function.`;
  document.getElementById("guidanceFunction").textContent = `Use ${assay}; predefine the smallest effect that would be worth following.`;
  document.getElementById("guidanceSpecificity").textContent = `Run wild type, ${ladder.conservative}, ${ladder.neutral}, and the matched-site perturbation at ${controlLabel} together.`;
  document.getElementById("diagnosticAdvance").textContent = `${candidateLabel} becomes a stronger site-specific hypothesis if its functional effect exceeds ${controlLabel} without a comparable integrity defect.`;
  document.getElementById("diagnosticFold").textContent = `Do not call mechanism. Reduce perturbation severity, improve expression controls, or test ${ladder.conservative} first.`;
  document.getElementById("diagnosticControl").textContent = `${candidateLabel} did not outperform the matched low-sensitivity control; the target-directed mechanical contrast was not supported. Change the target, mutation severity, or assay before assigning mechanism.`;
  document.getElementById("diagnosticNext").textContent = `Confirm assay sensitivity, then move to ${runnerUp?.label || "the next-ranked structural site"}.`;
  document.getElementById("alternatePacking").textContent = `${candidateLabel} may report local packing stress because it is ${contactClass}, rather than a specific functional pathway.`;
  document.getElementById("alternateExpression").textContent = `${ladder.neutral} may change abundance, folding or trafficking; those explanations must be measured before a site-specific interpretation.`;
  document.getElementById("alternateContext").textContent = `This static coordinate model may omit the assay-relevant state, ligand, partner or membrane context.`;
  document.getElementById("guidanceNext").textContent = runnerUp?.label || "No second site available";
  document.getElementById("viewerCandidate").textContent = candidateLabel;
  document.getElementById("viewerCandidateReason").textContent = candidate ? residueExplanation(candidate) : "NO RANKABLE CONTACT SIGNAL";
  document.getElementById("hudThesis").textContent = `${biology.identity}. ${biology.siteReason}`;
  document.getElementById("hudMutation").textContent = ladder.conservative;
  document.getElementById("hudMutationNote").textContent = disulfide ? "Disrupts the bridge; measure folding first." : `Smallest side-chain property change proposed for ${candidateLabel}.`;
  document.getElementById("hudControl").textContent = controlLabel;
  document.getElementById("hudGate").textContent = disulfide ? "MEASURE FOLD FIRST" : "FUNCTION EFFECT > CONTROL";
  document.getElementById("hudGateNote").textContent = disulfide ? `Do not assign a specific functional effect if ${candidateLabel} also lowers expression or folding.` : `${candidateLabel} must change the functional readout more than ${controlLabel} without a corresponding protein-quality defect.`;
}

function scoreEquationText(lensName = activeScoringLens) {
  const lens = scoreLenses[lensName] || scoreLenses.general;
  return `rank score = target-zone gate × 100 × [${Object.entries(lens.weights).filter(([,weight])=>weight>0).map(([feature,weight])=>`${weight.toFixed(2)}·${featureLabels[feature]}`).join(" + ")}]. Target-compliance sensitivity is converted to a within-structure percentile; the other terms are normalized within this structure.`;
}

function mutationLabelForResidue(residue) {
  const ladder = mutationLadder(residue);
  return `${mutationRationale(residue,ladder.conservative)} Stronger follow-up: ${ladder.neutral}. These are property probes, not predictions of benefit.`;
}

function mutationInteractionForecast(residue, substitution = mutationLadder(residue).conservative) {
  const targetCode=String(substitution).split("→")[1]?.trim();
  const target=oneToThree[targetCode] || null;
  const capabilityLabels={ polar:"polar donor/acceptor", positive:"positive charge", negative:"negative charge", hydrophobic:"non-polar packing", aromatic:"aromatic ring", disulfide:"disulfide sulfur", metal:"possible side-chain metal donor", imidazole:"imidazole coordination geometry" };
  const originalCapabilities=Object.entries(mutationCapabilities).filter(([,set])=>set.has(residue.name)).map(([name])=>name);
  const targetCapabilities=target ? Object.entries(mutationCapabilities).filter(([,set])=>set.has(target)).map(([name])=>name) : [];
  const lost=originalCapabilities.filter(name=>!targetCapabilities.includes(name));
  const gained=targetCapabilities.filter(name=>!originalCapabilities.includes(name));
  const interactions=(residue.interactionEvidence||[]).filter(row=>row.sidechain);
  const chosen=new Map();
  interactions.forEach(row=>{
    const key=`${row.partnerKey}|${row.type}`;
    if (!chosen.has(key)) chosen.set(key,row);
  });
  const changes=[...chosen.values()].filter(row=>row.type!=="direct" || ![...chosen.values()].some(other=>other.partnerKey===row.partnerKey&&other.type!=="direct")).slice(0,8).map(row=>{
    let retained=null;
    if (["polar","ligandPolar"].includes(row.type)) retained=targetCapabilities.includes("polar");
    else if (row.type==="ionic") retained=(originalCapabilities.includes("positive")&&targetCapabilities.includes("positive"))||(originalCapabilities.includes("negative")&&targetCapabilities.includes("negative"));
    else if (row.type==="hydrophobic") retained=targetCapabilities.includes("hydrophobic");
    else if (row.type==="aromatic") retained=targetCapabilities.includes("aromatic");
    else if (row.type==="disulfide") retained=targetCapabilities.includes("disulfide");
    else if (row.type==="metal") retained=target===residue.name?true:null;
    const status=row.type==="metal"&&target!==residue.name?"coordination changes":retained===true?"capability retained":retained===false?"capability lost":"geometry changes";
    return { ...row, status, retained };
  });
  const lostText=lost.length?`removes ${lost.map(name=>capabilityLabels[name]).join(", ")}`:"does not remove a tracked side-chain capability";
  const gainedText=gained.length?`; adds ${gained.map(name=>capabilityLabels[name]).join(", ")}`:"";
  return { target, changes, summary:`${substitution} ${lostText}${gainedText}. “Retained” means the mutant residue still has that broad chemical capability; it does not mean the original contact or geometry will remain.` };
}

function renderAtomicEvidence(residue, report) {
  if (!residue) return;
  const evidence=(residue.interactionEvidence||[]).filter(row=>row.sidechain);
  const byPartner=new Map();
  evidence.forEach(row=>{ if(!byPartner.has(row.partnerKey))byPartner.set(row.partnerKey,row); });
  const displayed=[...byPartner.values()].slice(0,10);
  document.getElementById("atomicPartnerCount").textContent=residue.atomicPartners;
  document.getElementById("atomicPolarCount").textContent=residue.polarContacts;
  document.getElementById("atomicIonicCount").textContent=residue.ionicContacts;
  document.getElementById("atomicHydrophobicCount").textContent=residue.hydrophobicContacts;
  document.getElementById("atomicAromaticCount").textContent=residue.aromaticContacts;
  document.getElementById("atomicLigandCount").textContent=`${residue.ligandAtomicContacts}${residue.metalContacts?` / ${residue.metalContacts}`:""}`;
  document.getElementById("atomicEvidenceResidue").textContent=residue.label;
  document.getElementById("atomicEvidenceIntro").textContent=`${residue.label} has ${residue.atomicPartners} residue partner${residue.atomicPartners===1?"":"s"} with a side-chain-involving heavy-atom contact at 4.5 Å or less${residue.ligandAtomicContacts?` and ${residue.ligandAtomicContacts} bound-group partner${residue.ligandAtomicContacts===1?"":"s"}`:""}.`;
  document.getElementById("atomicEvidenceRows").innerHTML=displayed.length?displayed.map(row=>`<div class="atomic-evidence-row"><i>${esc(interactionTypeLabel(row.type))}</i><strong>${esc(row.partnerLabel)}</strong><span>${esc(row.atom)}–${esc(row.partnerAtom)} · ${row.distance.toFixed(2)} Å${row.interchain?" · other chain":""}</span></div>`).join(""):`<p>No side-chain-involving heavy-atom partner was found within 4.5 Å in this coordinate model. The residue can still rank through target-compliance sensitivity, but the mutation has a weaker local-contact rationale.</p>`;
  const substitution=mutationLadder(residue).conservative;
  const forecast=mutationInteractionForecast(residue,substitution);
  document.getElementById("atomicMutationLabel").textContent=`${residue.label} ${substitution}`;
  document.getElementById("atomicMutationSummary").textContent=forecast.summary;
  document.getElementById("atomicChangeRows").innerHTML=forecast.changes.length?forecast.changes.map(row=>`<div class="atomic-change-row"><strong class="${row.retained===false?"lost":""}">${esc(row.status)}</strong><p>${esc(interactionTypeLabel(row.type))} with ${esc(row.partnerLabel)} (${esc(row.atom)}–${esc(row.partnerAtom)}, ${row.distance.toFixed(2)} Å in the original model).</p></div>`).join(""):`<div class="atomic-change-row"><strong>no local claim</strong><p>No mutation-sensitive side-chain contact class was assigned. Use the mutation as a wider structural-position test and rely on the candidate–control experiment.</p></div>`;
  document.getElementById("atomicBoundary").textContent="Rules used here: heavy-atom contact ≤4.5 Å; polar N/O/S proximity 2.35–3.60 Å; ionic side-chain geometry ≤4.0 Å; hydrophobic side-chain contact 3.0–4.6 Å; aromatic atom proximity 3.2–5.5 Å; metal donor distance ≤3.0 Å. Hydrogens, protonation, angles, solvation, relaxation and free energy are not calculated.";
  const control=report?matchedControlForResidue(report,residue):null;
  const atomicFeatures=new Set(["atomic","polar","ionic","ligandAtomic","coordination"]);
  const graphFeatures=new Set(["degree","weighted","longRange","interchain","closeness","betweenness"]);
  const differences=control?Object.keys(residue.contributions||{}).map(feature=>({ feature, delta:(residue.contributions[feature]||0)-(control.contributions?.[feature]||0), group:atomicFeatures.has(feature)?"atom-level":graphFeatures.has(feature)?"Cα graph":"structure context" })).filter(row=>row.delta>0.05).sort((a,b)=>b.delta-a.delta).slice(0,3):[];
  document.getElementById("atomicContrastTitle").textContent=control?`${residue.label} (${residue.score.toFixed(1)}) vs ${control.label} (${control.score.toFixed(1)})`:"No automatic control available";
  document.getElementById("atomicContrastSummary").textContent=control?`The candidate is ${(residue.score-control.score).toFixed(1)} rank points higher. This pair matches chemistry and local atom-level context while the control retains only ${(100*(control.leverageRatio??control.mechanicalLeverage/Math.max(residue.mechanicalLeverage,1e-18))).toFixed(0)}% of the candidate's first-order target-compliance sensitivity. The terms at right are the largest exact rank differences. If the pair behaves alike experimentally, the mechanical-sensitivity rationale is not supported.`:"Choose a lower-sensitivity residue with comparable chemistry, burial, B field and local atom-level context before interpreting this candidate.";
  document.getElementById("atomicContrastRows").innerHTML=differences.length?differences.map(row=>`<div class="atomic-contrast-row"><span>${esc(row.group)} · ${esc(featureLabels[row.feature]||row.feature)}</span><strong>+${row.delta.toFixed(1)} pts</strong><small>candidate contribution minus matched control</small></div>`).join(""):`<div class="atomic-contrast-row"><span>no resolved score gap</span><strong>—</strong><small>The selected control does not provide a positive term-by-term contrast.</small></div>`;
}

function matchedControlForResidue(report, residue) {
  return pickMatchedControl(report.allResidues, residue) || report.controlResidue || null;
}

function selectedExperimentQuestion(report, residue) {
  const control = matchedControlForResidue(report, residue);
  const candidateMutation = mutationLadder(residue).conservative;
  const controlMutation = control ? mutationLadder(control).conservative : "the matched-site perturbation";
  const assay = assayFor(report, residue, control);
  return `Does ${candidateMutation} at ${residue.label} change ${assay} more than ${control ? `${controlMutation} at ${control.label}` : "a matched lower-score control"}, while expression and folding remain comparable to wild type?`;
}

function selectedTestText(report, residue) {
  const control = matchedControlForResidue(report, residue);
  const assay = assayFor(report, residue, control);
  const constructs = experimentConstructs(report, residue);
  return [
    `RINet experiment sheet — ${current?.sourceName || report.metadata?.pdbId || "structure"}`,
    "",
    "QUESTION",
    selectedExperimentQuestion(report, residue),
    "",
    "WHY THIS SITE",
    `${residue.label} is rank ${residue.rank}/${report.rankableCount||report.allResidues.length} (score ${residue.score.toFixed(1)}, ${scoreLenses[report.scoringLens].label} model). ${residue.rationale}`,
    "",
    "WHAT THE MATCHED CONTROL TESTS",
    control ? `${control.controlRationale}` : "No automatic local-environment match was available; choose and document a chemistry-matched low-sensitivity control before interpreting the target response.",
    "",
    "BEFORE ORDERING",
    `Confirm that ${residue.label}${control ? ` and ${control.label}` : ""} map to the intended expression construct, author numbering, biological assembly and assay-relevant state.`,
    "",
    "CONSTRUCTS TO ORDER",
    ...constructs.map((row, index) => `${index + 1}. ${row.construct}${row.site === "—" ? "" : `: ${row.site} ${row.substitution}`} — ${row.purpose}`),
    "",
    "RUN ALL CONSTRUCTS IN THE SAME BATCH",
    `1. Primary functional readout: ${assay}.`,
    "2. Expression or abundance relative to wild type.",
    "3. One orthogonal folding, stability or assembly readout appropriate to the protein.",
    "4. Use the same preparation and blinded sample labels where practical; set replicate count and the smallest meaningful effect before collecting data.",
    "",
    "CALL THE SITE-SPECIFIC HYPOTHESIS SUPPORTED ONLY IF",
    `${residue.label} changes the primary readout more than ${control?.label || "the matched structural control"}, while expression and molecular integrity remain acceptably similar to wild type.`,
    "",
    "STOP OR REINTERPRET",
    "If candidate and matched control behave similarly, the ranking has not separated the site from structural background. If expression or integrity falls, treat the result as a stability/production effect before assigning function.",
    "",
    "LIMIT",
    "This is a structure-derived experimental contrast, not biological proof. RINet does not invent assay conditions, replicate counts or effect-size thresholds; set those from the validated assay and laboratory context."
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
  const assay = assayFor(report, residue, control);
  const constructs = experimentConstructs(report, residue);
  document.getElementById("selectedActionResidue").textContent = residue.label;
  document.getElementById("selectedActionScore").textContent = `rank ${residue.rank}/${report.rankableCount||report.allResidues.length} · target-compliance-sensitivity percentile ${(100*(residue.mechanicalPercentile||0)).toFixed(1)} · ${scoreLenses[report.scoringLens].label} question`;
  document.getElementById("selectedActionBoundary").textContent = `${residue.targetDistance.toFixed(1)} Å from ${report.activeTarget?.label||"the target"} · ${(100*(residue.mechanicalRobustness||0)).toFixed(0)}/100 cutoff robustness. These are model outputs, not a probability of function.`;
  document.getElementById("selectedActionReason").textContent = residue.rationale;
  document.getElementById("selectedActionMutation").textContent = constructs.map(row => row.site === "—" ? row.construct : `${row.construct}: ${row.site} ${row.substitution}`).join(" · ");
  document.getElementById("selectedActionControl").textContent = control ? `${control.label} · ${mutationLadder(control).conservative} · match ${control.matchQuality.toFixed(0)}/100. ${control.controlRationale}` : "No credible matched control could be constructed from this structure.";
  document.getElementById("selectedActionAssay").textContent = `1. ${assay}. 2. Expression or abundance. 3. One folding, stability or assembly readout. Compare every construct with wild type in the same batch.`;
  document.getElementById("selectedActionRule").textContent = `${residue.label} changes ${assay} more than ${control?.label || "the matched control"}, while expression and molecular integrity remain acceptably similar to wild type.`;
  const question=document.getElementById("workflowQuestion");
  if(question)question.textContent=workflowQuestions[report.scoringLens]||workflowQuestions.general;
  const candidate=document.getElementById("workflowCandidate");
  if(candidate)candidate.textContent=`${residue.label} ${mutationLadder(residue).conservative}`;
  const controlCard=document.getElementById("workflowControl");
  if(controlCard)controlCard.textContent=control?`${control.label} ${mutationLadder(control).conservative}`:"Manual control required";
  const measurements=document.getElementById("workflowMeasurements");
  if(measurements)measurements.textContent=`${assay} + abundance + fold/assembly`;
  updateAssaySetup(report, residue);
  renderEvidenceResiduePicker(report, residue);
  renderAtomicEvidence(residue, report);
}

function renderContributionAudit(residue, report = current?.report) {
  if (!residue || !report) return;
  document.getElementById("auditResidue").textContent = `${residue.label} · rank ${residue.rank}/${report.rankableCount||report.allResidues.length} · ${residue.score.toFixed(1)}`;
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
  const byLabel=new Map();report.allResidues.filter(row=>row.constructRepresentative!==false).forEach(row=>{byLabel.set(row.label,row);(row.equivalentAuthors||[row.authorLabel]).filter(Boolean).forEach(label=>byLabel.set(label,row));});
  const groups=benchmark.groups||[{label:benchmark.citation||"Curated site",sites:benchmark.sites||[],source:benchmark.source,citation:benchmark.citation,outcome:benchmark.note}];
  document.getElementById("benchmarkStatus").textContent=benchmark.status;
  document.getElementById("benchmarkRows").innerHTML=groups.map(group=>{
    const resolved=[...new Set((group.sites||[]).map(label=>byLabel.get(label)).filter(Boolean))];
    const best=[...resolved].sort((a,b)=>(a.rank||Infinity)-(b.rank||Infinity))[0];
    const result=best?`${esc(best.label)} · sensitivity percentile ${(100*(best.mechanicalPercentile||0)).toFixed(1)} · rank ${best.rank}/${report.rankableCount||report.allResidues.length}`:"not resolved in coordinates";
    return `<div class="benchmark-row"><span><strong>${esc(group.label)}</strong><small>${esc(group.perturbation||"")}</small></span><b>${result}<small>${esc(group.outcome||"")}</small></b></div>`;
  }).join("");
  document.getElementById("benchmarkBoundary").innerHTML=`${esc(benchmark.note)} ${groups.map(group=>`<a href="${group.source}" target="_blank" rel="noreferrer">${esc(group.citation)} ↗</a>`).join(" · ")}`;
}

function validationAuc(entries, valueFor) {
  const positives=entries.filter(entry=>entry.positive),negatives=entries.filter(entry=>!entry.positive);
  if(!positives.length||!negatives.length)return null;
  let wins=0,total=0;
  positives.forEach(positive=>negatives.forEach(negative=>{
    const left=valueFor(positive),right=valueFor(negative);
    if(!Number.isFinite(left)||!Number.isFinite(right))return;
    wins += left > right ? 1 : (left === right ? 0.5 : 0); total += 1;
  }));
  return total?wins/total:null;
}

function parseValidationLabels(text, report) {
  const lines=String(text).split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2)throw new Error("the CSV contains no label rows");
  const headers=parseAdaptiveCsvLine(lines[0]).map(header=>header.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_"));
  const column=(...names)=>names.map(name=>headers.indexOf(name)).find(index=>index>=0)??-1;
  const indices={chain:column("chain","author_chain"),residue:column("residue","author_residue","residue_number"),insertion:column("insertion","insertion_code"),positive:column("known_functional","positive","label"),conservation:column("conservation_score","evolution_score"),md:column("md_score"),external:column("external_score")};
  if(indices.chain<0||indices.residue<0||indices.positive<0)throw new Error("required columns are chain, residue and known_functional");
  const representativeByKey=new Map(),byResidueKey=new Map(report.residueMetrics.map(row=>[row.key,row]));
  report.residueMetrics.forEach(row=>{
    const representative=row.constructRepresentative===false?byResidueKey.get(row.duplicateOf):row;
    if(representative)representativeByKey.set(`${row.chain}|${row.seq}|${row.insertion||""}`,representative);
  });
  const parsed=[],unresolved=[],conflicts=[];
  lines.slice(1).forEach((line,lineIndex)=>{
    const cells=parseAdaptiveCsvLine(line),chain=(cells[indices.chain]||"").trim(),residueText=(cells[indices.residue]||"").trim(),insertionCell=indices.insertion>=0?(cells[indices.insertion]||"").trim():"",match=residueText.match(/^(-?\d+)(.*)$/);
    if(!chain||!match)return;
    const seq=Number(match[1]),insertion=insertionCell||match[2].trim(),rawLabel=(cells[indices.positive]||"").trim().toLowerCase();
    const positive=["1","true","yes","positive","functional"].includes(rawLabel)?true:["0","false","no","negative","neutral"].includes(rawLabel)?false:null;
    if(positive===null)return;
    const residue=representativeByKey.get(`${chain}|${seq}|${insertion}`);
    if(!residue){unresolved.push(`${chain}:${seq}${insertion}`);return;}
    const numeric=index=>index>=0&&String(cells[index]||"").trim()!==""?Number(cells[index]):null;
    parsed.push({line:lineIndex+2,residue,positive,conservation:numeric(indices.conservation),md:numeric(indices.md),external:numeric(indices.external)});
  });
  const deduplicated=new Map();
  parsed.forEach(entry=>{
    const prior=deduplicated.get(entry.residue.label);
    if(prior&&prior.positive!==entry.positive){conflicts.push(entry.residue.label);return;}
    if(!prior)deduplicated.set(entry.residue.label,entry);
    else ["conservation","md","external"].forEach(field=>{if(!Number.isFinite(prior[field])&&Number.isFinite(entry[field]))prior[field]=entry[field];});
  });
  return {entries:[...deduplicated.values()],unresolved:[...new Set(unresolved)],conflicts:[...new Set(conflicts)],inputRows:lines.length-1};
}

function renderImportedValidation(result, report) {
  const target=document.getElementById("validationImportResult");if(!target)return;
  const entries=result.entries,positives=entries.filter(entry=>entry.positive),negatives=entries.filter(entry=>!entry.positive),topN=Math.min(10,report.rankableCount||report.allResidues.length),topHits=positives.filter(entry=>entry.residue.rank&&entry.residue.rank<=topN).length,expected=topN*positives.length/Math.max(report.rankableCount||report.allResidues.length,1),enrichment=expected?topHits/expected:null;
  const scores=[
    {label:"RINet complete score",value:validationAuc(entries,entry=>entry.residue.score)},
    {label:"Target-compliance sensitivity",value:validationAuc(entries,entry=>entry.residue.mechanicalLeverage)},
    {label:"Target distance only",value:validationAuc(entries,entry=>-entry.residue.targetDistance)},
    {label:"Cα degree only",value:validationAuc(entries,entry=>entry.residue.degree)},
    {label:"Imported conservation",value:validationAuc(entries,entry=>entry.conservation)},
    {label:"Imported MD",value:validationAuc(entries,entry=>entry.md)},
    {label:"Imported external score",value:validationAuc(entries,entry=>entry.external)}
  ].filter(row=>Number.isFinite(row.value));
  const caveat=positives.length&&negatives.length?"AUROC uses only resolved, explicitly labelled positives and negatives.":"Add both positive and negative labels to calculate AUROC; unlabelled residues are not treated as negatives.";
  target.innerHTML=`<div class="validation-summary"><span>Resolved labels<b>${entries.length}/${result.inputRows}</b></span><span>Positive / negative<b>${positives.length} / ${negatives.length}</b></span><span>Top-${topN} positive recovery<b>${topHits}/${positives.length||0}</b></span><span>Top-${topN} enrichment<b>${Number.isFinite(enrichment)?`${enrichment.toFixed(2)}×`:"—"}</b></span></div>${scores.map(row=>`<div class="validation-score-row"><span>${esc(row.label)}</span><b>AUROC ${row.value.toFixed(3)}</b></div>`).join("")}<p>${esc(caveat)}${result.unresolved.length?` Unresolved identifiers: ${esc(result.unresolved.slice(0,8).join(", "))}${result.unresolved.length>8?"…":""}.`:""}${result.conflicts.length?` Conflicting duplicate labels were ignored for ${esc(result.conflicts.join(", "))}.`:""}</p>`;
}

function downloadValidationTemplate() {
  if(!current)return;
  const csv="chain,residue,insertion,known_functional,conservation_score,md_score,external_score\n";
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
  link.href=url;link.download=`rinet-${(current.report.metadata?.pdbId||"structure").toLowerCase()}-validation-labels.csv`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
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
  const baseRanked=[...report.allResidues].sort((a,b)=>(b.mechanicalByCutoff?.find(item=>item.cutoff===8.5)?.leverage||0)-(a.mechanicalByCutoff?.find(item=>item.cutoff===8.5)?.leverage||0)),baseTop=new Set(baseRanked.slice(0,10).map(row=>row.label));
  document.getElementById("sensitivityRows").innerHTML=[8,8.5,9].map(cutoff=>{const ranked=[...report.allResidues].sort((a,b)=>(b.mechanicalByCutoff?.find(item=>item.cutoff===cutoff)?.leverage||0)-(a.mechanicalByCutoff?.find(item=>item.cutoff===cutoff)?.leverage||0));const rank=ranked.findIndex(item=>item.label===reference.label)+1,overlap=ranked.slice(0,10).filter(item=>baseTop.has(item.label)).length,leverage=reference.mechanicalByCutoff?.find(item=>item.cutoff===cutoff)?.leverage||0;return `<div class="sensitivity-row"><span>${cutoff.toFixed(1)} Å · ${overlap}/10 sensitivity-site overlap</span><b>${esc(reference.label)} sensitivity rank ${rank||"N/A"} · ${leverage.toExponential(2)}</b></div>`;}).join("");
}

function renderExpertRanking(report, query = "") {
  const needle=query.trim().toLowerCase();
  const rows=report.allResidues.filter(row=>!needle||`${row.label} ${row.rationale} ${row.chain}`.toLowerCase().includes(needle)).slice(0,500);
  document.getElementById("expertRows").innerHTML=rows.map(row=>`<tr class="expert-row" data-expert-label="${esc(row.label)}"><td>${row.rank}</td><td>${esc(row.label)}</td><td>${row.score.toFixed(1)}</td><td>${(100*(row.mechanicalPercentile||0)).toFixed(1)}</td><td>${(100*(row.mechanicalRobustness||0)).toFixed(0)}/100</td><td>${Number.isFinite(row.targetDistance)?row.targetDistance.toFixed(1):"—"}</td><td>${(100*(row.mutationLeverage||0)).toFixed(0)}%</td><td>${row.atomicPartners}</td><td>${row.polarContacts}</td><td>${row.ionicContacts}</td><td>${row.degree}</td><td>${row.betweenness.toFixed(2)}</td><td>${row.interchain}</td><td>${esc(row.context)}</td></tr>`).join("");
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

function renderMechanicalTarget(report){
  const target=report.activeTarget,select=document.getElementById("targetSelect");if(!target||!select)return;
  select.innerHTML=report.targetOptions.map(option=>`<option value="${esc(option.id)}" ${option.id===target.id?"selected":""}>${esc(option.label)} · ${option.residueKeys.length} residue${option.residueKeys.length===1?"":"s"}</option>`).join("");
  document.getElementById("mechanicalTargetLabel").textContent=target.label;
  document.getElementById("mechanicalTargetCount").textContent=`${target.residueKeys.length} resolved target residue${target.residueKeys.length===1?"":"s"}`;
  const central=report.mechanicalModel?.profiles?.find(profile=>profile.cutoff===8.5)||report.mechanicalModel?.profiles?.[0];
  document.getElementById("mechanicalNetworkSize").textContent=central?`${central.modelNodeCount} node${central.modelNodeCount===1?"":"s"} · ${central.edges} springs`:`${report.residueMetrics.length} nodes`;
  document.getElementById("mechanicalSolverStatus").textContent=central?`PCG residual ${central.residual.toExponential(1)} · ridge ${central.ridge.toExponential(1)}`:"Mechanical response unavailable";
  document.getElementById("mechanicalModelDetail").textContent=central?`H is the ${3*central.modelNodeCount} × ${3*central.modelNodeCount} anisotropic-network Hessian for ${central.edges} Cα springs at 8.5 Å. Net-zero unit forces are applied across ${target.residueKeys.length} target residue${target.residueKeys.length===1?"":"s"} along x, y and z. The linear systems use preconditioned conjugate gradients with a disclosed ridge of ${central.ridge.toExponential(2)}; the calculation is repeated at 8.0 and 9.0 Å.${central.modelNodeCount<central.fullNodeCount?` For interactive analysis of this large assembly, the mechanical domain contains the ${central.modelNodeCount} residues nearest the target out of ${central.fullNodeCount}; excluded residues are not ranked by target sensitivity.`:""}`:"No target response could be calculated.";
  const status=document.getElementById("targetStatus");status.textContent=`Ranking now asks which mutation should most change compliance of ${target.label}. Change the target to recalculate every residue.`;status.classList.add("success");
}

function refreshRankedOutputs(report, { resetSelection = true } = {}) {
  document.getElementById("topologyRows").innerHTML = report.topResidues.map((residue,i)=>`<div class="topology-row"><strong>${String(i+1).padStart(2,"0")} / ${esc(residue.label)}</strong><span>PRIORITY ${residue.score.toFixed(1)} · DEG ${residue.degree}</span></div>`).join("");
  document.getElementById("bestResidueRows").innerHTML = report.topResidues.map((residue,i)=>`<button class="best-residue-row" type="button" data-residue-index="${i}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(residue.label)}<em>${esc(residue.context)}</em></strong><small>${residue.score.toFixed(1)}</small></button>`).join("");
  document.querySelectorAll(".best-residue-row").forEach(button=>button.addEventListener("click",()=>selectAnalyzedResidue(report.topResidues[Number(button.dataset.residueIndex)],{button,autoView:true})));
  renderMechanicalTarget(report);renderGuidance(report);renderDiscovery(report,activeDiscoveryMode);renderScientificPanels(report,resetSelection?report.topResidues[0]:(molecular.selectedResidue||report.topResidues[0]));
  molecular.topResidues=report.topResidues;molecular.resultScheme=buildResultColorScheme(report.topResidues);setMolecularRepresentation(molecular.representation);
  if(resetSelection) selectAnalyzedResidue(report.topResidues[0],{autoView:false});
}


function mechanochemicalMethodsText(data){
  const r=data.report,target=r.activeTarget,central=r.mechanicalModel?.profiles?.find(profile=>profile.cutoff===8.5)||r.mechanicalModel?.profiles?.[0],largeDomain=central&&central.modelNodeCount<central.fullNodeCount;
  return [
    `Coordinates from ${data.sourceName} were parsed locally with RINet Targeted Mechanochemical Contrast 1.0 (receipt ${data.receiptId}; ${r.format}).`,
    `The structure contained ${r.residues} polymer residues and ${r.polymerAtoms} polymer atoms across ${r.chainReports.length} author chain${r.chainReports.length===1?"":"s"}. The functional target was ${target?.label||"not resolved"}, represented by ${target?.residueKeys.length||0} Cα node${target?.residueKeys.length===1?"":"s"} selected from polymer–bound-group contacts, cross-chain atom contacts, or user-supplied author residue numbers.`,
    `A three-dimensional anisotropic elastic network was built with ${central?.modelNodeCount||r.residueMetrics.length} Cα nodes and ${central?.edges||0} uniform harmonic springs at the primary 8.5 Å cutoff.${largeDomain?` For this large assembly, the interactive domain was restricted to the ${central.modelNodeCount} residues nearest the target out of ${central.fullNodeCount}; excluded residues received no mechanical rank.`:""}`,
    `Net-zero unit forces were distributed across the target along x, y and z. Each linear system (H + λI)u = f was solved with diagonally preconditioned conjugate gradients (λ ${central?.ridge?.toExponential(3)||"not available"}; maximum residual ${central?.residual?.toExponential(2)||"not available"}). The calculation was repeated at 8.0 and 9.0 Å.`,
    `For each spring e=(p,q), target-load extension was δe = ne·(up−uq). Residue i first-order target-compliance sensitivity was Si(T)=Σe∋i meanx,y,z(δe²). If the springs incident to i are fractionally weakened by ε, the linear estimate is ΔJtarget≈εSi, where Jtarget=fᵀ(H+λI)⁻¹f. This is the primary mechanical ranking. Cross-compliance ||CiT||F/sqrt(tr(Cii)tr(CTT)) was also calculated as a response descriptor; diagonal compliance used eight deterministic Rademacher probes.`,
    `Sensitivity robustness was 1/(1 + coefficient of variation) across 8.0, 8.5 and 9.0 Å. ${scoreEquationText(r.scoringLens)}`,
    `The conservative substitution was audited against typed side-chain contacts to estimate what fraction of local constraint capacity it can change. Side-chain-involving heavy-atom contacts used 4.5 Å; polar N/O/S proximity 2.35–3.60 Å; opposite-charge geometry 4.0 Å; hydrophobic C/S proximity 3.0–4.6 Å; aromatic atom proximity 3.2–5.5 Å; and metal-donor proximity 3.0 Å. Mutation constraint leverage is a design heuristic, not ΔΔG.`,
    `The automatic control minimizes differences in residue class, atom-level partners, polar and ligand contacts, burial, B field and chain while requiring substantially lower target-compliance sensitivity. The experimental claim is supported only if the candidate alters the target-linked functional readout more than that matched control while abundance and fold/assembly remain acceptable.`,
    `The mechanical model is a near-native-state linear approximation. Atomistic relaxation, ΔΔG, solvent, kinetics and conformational ensembles are separate validation layers when required by the system. Known labels, when bundled, were evaluated after ranking and contributed no score.`
  ].join(" ");
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
  renderMechanicalTarget(r);
  renderGuidance(r);
  renderDiscovery(r, "biology");
  renderScientificPanels(r,r.topResidues[0]);
  renderAdaptivePanel(r,{rebuild:true,clearResults:true});
  fillBuiltInDemoResults(r);
  document.getElementById("methodsText").textContent = mechanochemicalMethodsText(data);
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

function constructSelection(residue,report=current?.report){
  const authors=new Set(residue?.equivalentAuthors||[residue?.authorLabel||residue?.label]);
  const copies=(report?.residueMetrics||[]).filter(row=>authors.has(row.authorLabel));
  return (copies.length?copies:[residue]).filter(Boolean).map(residueSelection).join(" OR ");
}

function addTargetRepresentations() {
  if (!molecular.component || !molecular.topResidues.length) return;
  const candidate = molecular.topResidues[0];
  const secondary = molecular.topResidues.slice(1, 5);
  const targetResidues=(current?.report?.activeTarget?.residueKeys||[]).map(key=>current.report.allResidues.find(row=>row.key===key)).filter(Boolean);
  if(targetResidues.length)molecular.component.addRepresentation("ball+stick",{sele:targetResidues.map(residueSelection).join(" OR "),color:"#ffad61",scale:1.18,opacity:.94,quality:"high"});
  const heteroMatch=current?.report?.activeTarget?.id?.match(/^hetero:([^:]+):([^:]+):(-?\d+)$/);
  if(heteroMatch){const [,name,chain,seq]=heteroMatch;molecular.component.addRepresentation("ball+stick",{sele:`${seq}:${chain} and ${name} and not protein`,colorScheme:"element",scale:1.4,quality:"high"});}
  if (secondary.length) molecular.component.addRepresentation("ball+stick", { sele: secondary.map(row=>constructSelection(row)).join(" OR "), color: "#69d7ff", scale: 1.05, opacity: .86, quality: "high" });
  const candidateSelection=constructSelection(candidate);
  molecular.component.addRepresentation("ball+stick", { sele: candidateSelection, color: "#d9ff58", scale: 1.55, quality: "high" });
  molecular.component.addRepresentation("spacefill", { sele: `(${candidateSelection}) and .CA`, color: "#d9ff58", scale: 1.15, quality: "high" });
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
  if (residue.interchain) return `TARGET SENSITIVITY PERCENTILE ${(100*(residue.mechanicalPercentile||0)).toFixed(0)} · ${residue.interchain} CROSS-CHAIN CONTACTS`;
  return `TARGET SENSITIVITY PERCENTILE ${(100*(residue.mechanicalPercentile||0)).toFixed(0)} · ${Number.isFinite(residue.targetDistance)?`${residue.targetDistance.toFixed(1)} Å FROM TARGET`:`${residue.degree} CONTACTS`}`;
}

function selectAnalyzedResidue(residue, { button = null, autoView = false, updateDiscovery = true } = {}) {
  if (!molecular.component || !residue) return;
  if (molecular.highlight) molecular.highlight.forEach(representation => molecular.component.removeRepresentation(representation));
  const selection = constructSelection(residue);
  molecular.highlight = [
    molecular.component.addRepresentation("ball+stick", { sele: selection, color: "#ff6f9f", scale: 1.65, quality: "high" }),
    molecular.component.addRepresentation("spacefill", { sele: `(${selection}) and .CA`, color: "#ff6f9f", scale: 1.2, quality: "high" })
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

function recalculateForTarget(targetId){
  if(!current)return;
  const status=document.getElementById("targetStatus");if(status){status.textContent="Solving the three target-response networks…";status.classList.remove("success");}
  applyMechanicalTarget(current.report,targetId);rerankReport(current.report,activeScoringLens);refreshRankedOutputs(current.report);
  renderAdaptivePanel(current.report,{rebuild:true,clearResults:true});fillBuiltInDemoResults(current.report);
  document.getElementById("methodsText").textContent=mechanochemicalMethodsText(current);
  setLocalActionStatus(`Mechanical response recalculated for ${current.report.activeTarget.label}. ${current.report.topResidues[0].label} is the first candidate under the ${scoreLenses[activeScoringLens].label.toLowerCase()} question.`,true);
}

document.getElementById("targetSelect")?.addEventListener("change",event=>recalculateForTarget(event.currentTarget.value));
document.getElementById("applyManualTarget")?.addEventListener("click",()=>{
  if(!current)return;
  const input=document.getElementById("manualTargetInput"),tokens=input.value.split(/[;,\n]+/).map(value=>value.trim()).filter(Boolean),resolved=[];
  tokens.forEach(token=>{const match=token.match(/(?:^|\s)([A-Za-z0-9]+)\s*:\s*(-?\d+)\s*([A-Za-z]?)\s*$/);if(!match)return;const [,chain,seq,insertion]=match;const residue=current.report.residueMetrics.find(row=>row.chain===chain&&row.seq===Number(seq)&&(row.insertion||"").toUpperCase()===insertion.toUpperCase());if(residue&&!resolved.includes(residue.key))resolved.push(residue.key);});
  const status=document.getElementById("targetStatus");
  if(!resolved.length){status.textContent="No residues matched. Use author numbering such as A:87, A:92.";status.classList.remove("success");return;}
  const id=`manual:${resolved.join("|")}`,target={id,type:"manual",label:"Manual site",residueKeys:resolved};
  const existing=current.report.targetOptions.findIndex(option=>option.id===id);if(existing>=0)current.report.targetOptions[existing]=target;else current.report.targetOptions.push(target);
  recalculateForTarget(id);
});

document.querySelectorAll("[data-scoring-lens]").forEach(button=>button.addEventListener("click",()=>{
  if(!current)return;
  activeScoringLens=button.dataset.scoringLens;
  document.querySelectorAll("[data-scoring-lens]").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-selected",String(active));});
  rerankReport(current.report,activeScoringLens);
  refreshRankedOutputs(current.report);
  renderAdaptivePanel(current.report,{rebuild:true,clearResults:true});
  fillBuiltInDemoResults(current.report);
  document.getElementById("methodsText").textContent=mechanochemicalMethodsText(current);
  setLocalActionStatus(`Structural ranking recalculated for the “${scoreLenses[activeScoringLens].label}” question. ${current.report.topResidues[0].label} is now rank 1.`, true);
}));

document.getElementById("rebuildAdaptivePanel")?.addEventListener("click",()=>{
  if(!current)return;
  renderAdaptivePanel(current.report,{rebuild:true,clearResults:true});
  fillBuiltInDemoResults(current.report);
});
document.getElementById("adaptivePanelSize")?.addEventListener("change",event=>{
  adaptiveRound.panelSize=Number(event.currentTarget.value);
  if(current){renderAdaptivePanel(current.report,{rebuild:true,clearResults:true});fillBuiltInDemoResults(current.report);}
});
document.getElementById("downloadAdaptiveTemplate")?.addEventListener("click",downloadAdaptiveTemplate);
document.getElementById("adaptiveResultsFile")?.addEventListener("change",async event=>{
  await importAdaptiveResults(event.currentTarget.files?.[0]);
  event.currentTarget.value="";
});
document.getElementById("loadAdaptiveExample")?.addEventListener("click",()=>loadAdaptiveExample());
document.getElementById("analyzeAdaptiveResults")?.addEventListener("click",()=>analyzeAdaptiveResults());
["adaptiveFunctionThreshold","adaptiveIntegrityFloor"].forEach(id=>document.getElementById(id)?.addEventListener("change",()=>{
  if(!current)return;
  const completed=adaptiveRound.panel.filter(entry=>entry.residue).filter(entry=>{const result=adaptiveRound.results.get(entry.key);return [result?.function,result?.abundance,result?.integrity].every(Number.isFinite);}).length;
  if(completed>=3)analyzeAdaptiveResults(current.report);else renderAdaptivePanel(current.report,{rebuild:false});
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
  window.requestAnimationFrame(() => { field.focus(); field.select(); field.scrollTop = 0; });
}

document.getElementById("applyAssay")?.addEventListener("click",()=>{
  if(!current)return;
  const residue=currentEvidenceResidue()||current.report.topResidues[0];
  customAssay=document.getElementById("assayInput").value.trim();
  renderGuidance(current.report,residue);
  renderDiscovery(current.report,activeDiscoveryMode);
  renderSelectedAction(residue,current.report);
  const button=document.getElementById("applyAssay");
  button.textContent=customAssay?"Readout applied":"Using suggestion";
  window.setTimeout(()=>button.textContent="Use this readout",1500);
  setLocalActionStatus(customAssay?`Experiment sheet updated to use: ${customAssay}. Structural scores did not change.`:"RINet's suggested readout restored. Structural scores did not change.",true);
});

document.getElementById("resetAssay")?.addEventListener("click",()=>{
  if(!current)return;
  customAssay="";
  const residue=currentEvidenceResidue()||current.report.topResidues[0];
  renderGuidance(current.report,residue);
  renderDiscovery(current.report,activeDiscoveryMode);
  renderSelectedAction(residue,current.report);
  setLocalActionStatus("RINet's protein-specific assay suggestion restored. Structural scores did not change.",true);
});

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
  openCopyDialog(`${residue.label} experiment sheet`, selectedTestText(current.report,residue));
  setLocalActionStatus("Experiment sheet opened: constructs, measurements, comparison and stop rule are ready to copy.",true);
};

document.getElementById("downloadConstructs")?.addEventListener("click",()=>{
  const residue=currentEvidenceResidue();
  if(!current||!residue)return;
  const quote=value=>`"${String(value).replaceAll('"','""')}"`;
  const rows=experimentConstructs(current.report,residue);
  const csv=["construct,site,substitution,purpose",...rows.map(row=>[row.construct,row.site,row.substitution,row.purpose].map(quote).join(","))].join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url;
  link.download=`rinet-${residue.label.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-constructs.csv`;
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  setLocalActionStatus("Construct list downloaded as CSV. Confirm every author residue number against the expression construct before ordering.",true);
});

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
    target.innerHTML=`<p><b>${comparisons.length}/10 primary-state top sites matched by exact author identifier.</b> The same target definition was used when it could be resolved in both structures.</p>${comparisons.map(({first,second:other})=>`<div class="sensitivity-row"><span>${esc(first.label)} · target sensitivity ${first.mechanicalLeverage.toExponential(2)} → ${other.mechanicalLeverage.toExponential(2)} · Δdegree ${(other.degree-first.degree)>=0?"+":""}${other.degree-first.degree}</span><b>sensitivity percentile ${(100*first.mechanicalPercentile).toFixed(0)} → ${(100*other.mechanicalPercentile).toFixed(0)}</b></div>`).join("")}<p>State-dependent sensitivity is interpretable only after reconciling construct, ligand, assembly, numbering and missing-coordinate differences.</p>`;
  }catch(error){target.textContent=`State comparison stopped: ${error.message}.`;}
});

document.getElementById("downloadValidationTemplate")?.addEventListener("click",downloadValidationTemplate);
document.getElementById("validationLabelsFile")?.addEventListener("change",async event=>{
  const file=event.currentTarget.files?.[0],target=document.getElementById("validationImportResult");
  if(!file||!current)return;
  target.textContent=`Evaluating ${file.name} against the current ranking…`;
  try{renderImportedValidation(parseValidationLabels(await file.text(),current.report),current.report);}
  catch(error){target.textContent=`Validation import stopped: ${error.message}.`;}
  event.currentTarget.value="";
});

document.getElementById("copyMethods").addEventListener("click",()=>openCopyDialog("Reproducible methods",document.getElementById("methodsText").textContent));
document.getElementById("closeCopyDialog")?.addEventListener("click",()=>document.getElementById("copyDialog")?.close());
document.getElementById("copyDialog")?.addEventListener("click",event=>{if(event.target===event.currentTarget)event.currentTarget.close();});

function receiptPayload() {
  const adaptivePanel=adaptiveRound.panel.map(entry=>({constructType:entry.type,residue:entry.residue?.label||"WT",mutation:entry.mutation,role:entry.role,matchedTo:entry.candidateFor?.label||null,reason:entry.why,result:adaptiveRound.results.get(entry.key)||null}));
  const central=current.report.mechanicalModel?.profiles?.find(profile=>profile.cutoff===8.5)||current.report.mechanicalModel?.profiles?.[0]||null;
  return { tool:"RINet Targeted Mechanochemical Contrast", version:"1.0", receiptId:current.receiptId, analyzedAt:current.analyzedAt, sourceLabel:current.sourceName, sourceType:current.sourceType, structureSha256:current.digest, selectedAssay:customAssay||null, selectedTarget:current.report.activeTarget, mechanicalModel:central, sensitivityCutoffsAngstrom:[8,8.5,9], scoringLens:current.report.scoringLens, exactScoreWeights:current.report.scoreWeights, typedInteractionRules:{heavyAtomContactAngstrom:4.5,polarProximityAngstrom:[2.35,3.6],ionicGeometryAngstrom:4.0,hydrophobicContactAngstrom:[3.0,4.6],aromaticProximityAngstrom:[3.2,5.5],metalCoordinationAngstrom:3.0}, benchmarkManifest:benchmarkManifest[current.report.metadata?.pdbId]||null, experimentRound:{panelSize:adaptiveRound.panelSize,panel:adaptivePanel,illustrativeResults:adaptiveRound.example}, summary:current.report, scientificBoundary:"Target-loaded anisotropic-network response, first-order target-compliance sensitivity to local spring weakening, typed coordinate contacts, and an explicit candidate/control experiment. This near-native linear model does not substitute for mutant relaxation, ΔΔG, solvent, kinetics, ensembles, or experimental validation." };
}

document.getElementById("downloadReceipt").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(receiptPayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${current.receiptId.toLowerCase()}-structure-brief.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
});

switchSource("id", false);
window.scrollTo({ top: 0, behavior: "auto" });
initPreview();
if (new URLSearchParams(window.location.search).get("demo") === "1") loadDemo();
