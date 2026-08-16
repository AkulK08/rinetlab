const els = {
  fileTab: document.getElementById("fileTab"), idTab: document.getElementById("idTab"),
  filePanel: document.getElementById("filePanel"), idPanel: document.getElementById("idPanel"),
  fileInput: document.getElementById("fileInput"), dropzone: document.getElementById("dropzone"),
  pdbForm: document.getElementById("pdbForm"), pdbId: document.getElementById("pdbId"),
  resultPdbForm: document.getElementById("resultPdbForm"), resultPdbId: document.getElementById("resultPdbId"),
  demoButton: document.getElementById("demoButton"), status: document.getElementById("status"),
  analysisStatus: document.getElementById("analysisStatus"), results: document.getElementById("results"), receiptForm: document.getElementById("receiptForm")
};

let current = null;
const molecular = { stage: null, component: null, representation: "surface", spinning: true, highlight: null, topResidues: [], resultScheme: null, selectedResidue: null };
let activeDiscoveryMode = "biology";
const preview = { stage: null, component: null };
const waterNames = new Set(["HOH", "WAT", "DOD"]);
const metalElements = new Set(["LI", "NA", "MG", "AL", "K", "CA", "MN", "FE", "CO", "NI", "CU", "ZN", "SR", "MO", "CD", "CS", "BA", "HG"]);
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

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
  const neutral = { ARG: "R→Q", LYS: "K→Q", ASP: "D→N", GLU: "E→Q", HIS: "H→N", SER: "S→A", THR: "T→A", ASN: "N→A", GLN: "Q→A", CYS: "C→A" };
  const stress = { ARG: "R→E", LYS: "K→E", ASP: "D→K", GLU: "E→K", HIS: "H→E", GLY: "G→P", PRO: "P→G" };
  return {
    conservative: conservative[name] || `${name}→similar residue`,
    neutral: neutral[name] || `${name}→Ala`,
    stress: residue?.disulfidePartner ? `${residue.disulfidePartner.label.replace("CYS ", "Cys ")}→Ser` : (stress[name] || `${name}→Pro`)
  };
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

function biologicalGuidance(report) {
  const metadata = report.metadata || {};
  const candidate = report.topResidues[0];
  const control = report.controlResidue;
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
  const siteReason = candidate?.interchain
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

function parsePdb(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const metadata = parseMetadata(lines);
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
    const report = parsePdb(text);
    const digest = await sha256(text);
    const receiptId = `RNB-${digest.slice(0, 12).toUpperCase()}`;
    current = { sourceName, sourceType, digest, receiptId, report, rawText: text, analyzedAt: new Date().toISOString() };
    render(current);
    fetchPublicBiology(report);
    setStatus(`Complete. ${sourceName} was parsed locally; no coordinates were sent to RINet.`);
  } catch (error) {
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
      title: "Map where structure becomes phenotype.",
      thesis: `Treat ${biology.identity.toLowerCase()} as a biological system with a measurable output, not only as a ranked list of residues.`,
      opportunity: `Use ${candidateLabel} and ${controlLabel} to ask whether a structurally distinct intervention produces a distinct biological response.`,
      program: `Test ${firstChange}, a matched perturbation at ${controlLabel}, and wild type. Measure integrity first, then ${biology.assay}.`,
      question: `Does the candidate change the protein-specific output more than structural background while molecular integrity remains intact?`
    },
    engineering: {
      title: "Tune function without breaking the fold.",
      thesis: "Turn the structure into a small design ladder that separates useful tuning from generic destabilization.",
      opportunity: `Explore conservative, neutralizing and stronger changes around ${candidateLabel} while using ${controlLabel} as a structural baseline.`,
      program: `Build a three-step chemistry ladder at ${candidateLabel}. Screen abundance and folding, then advance only intact constructs into ${biology.assay}.`,
      question: "Can the response be shifted in a graded way without losing expression, assembly or fold quality?"
    },
    translation: {
      title: "Separate tractable intervention sites from structural liabilities.",
      thesis: "A useful structural brief distinguishes a specific change in protein behavior from a general loss of molecular integrity.",
      opportunity: `Use the candidate and matched control to classify observed variants or interventions by function, abundance and fold rather than by one score.`,
      program: `Measure abundance, one orthogonal integrity readout and ${biology.assay} in the same batch. Keep conclusions at the protein level unless clinical evidence is supplied.`,
      question: "Which measurement cleanly distinguishes a functional effect from reduced expression, misfolding or failed assembly?"
    },
    mechanism: {
      title: "Find the shortest experiment that separates competing models.",
      thesis: `Use ${candidateLabel} as a perturbation, not as a conclusion. The goal is to distinguish local packing, ligand coupling, assembly effects and genuine functional control.`,
      opportunity: `Compare ${candidateLabel}, ${controlLabel} and the next ranked site across a shared integrity and function panel.`,
      program: `Predefine predictions for local packing, fold loss and site-specific function. Use ${biology.assay} only after the integrity gate passes.`,
      question: "Which single outcome would force the leading structural explanation to be abandoned?"
    }
  };
  if (!isOxygenAssembly) return generic;
  return {
    biology: {
      title: "Treat oxygen delivery as a coupled system.",
      thesis: "This tetramer connects local heme chemistry, subunit interfaces and cooperative oxygen binding. The most valuable question spans all three scales.",
      opportunity: "Measure which interventions preserve heme occupancy but alter oxygen affinity or cooperativity. This separates oxygen handling from generic protein damage.",
      program: `Compare ${candidateLabel}, an interface-ranked site and ${controlLabel}. Measure heme spectra, oxygen equilibrium and tetramer integrity in the same preparation.`,
      question: "Where does local heme chemistry become cooperative behavior across subunits?"
    },
    engineering: {
      title: "Engineer the response curve, not only stability.",
      thesis: "The design objective is a controlled change in oxygen affinity or cooperativity while heme loading and tetramer assembly remain intact.",
      opportunity: `Use ${candidateLabel} as the chemistry-linked anchor, then compare graded perturbations at a subunit interface and matched structural background.`,
      program: "Build a small perturbation ladder across heme-contact, interface and network sites. Measure heme occupancy, oxygen curves and oligomeric state before choosing a lead.",
      question: "Can an intervention shift oxygen response without altering heme loading or tetramer integrity?"
    },
    translation: {
      title: "Separate variant mechanism from generic protein damage.",
      thesis: "A variant can alter heme binding, cooperative response, assembly or fold. Those are different molecular classes and require different evidence.",
      opportunity: "Classify oxygen-transport variants with a compact panel instead of treating every functional loss as the same mechanism.",
      program: "Measure abundance, heme occupancy, the oxygen equilibrium curve and oligomerization. Keep the output as molecular evidence, not medical advice.",
      question: "Which readout distinguishes altered oxygen behavior from heme loss, assembly failure or destabilization?"
    },
    mechanism: {
      title: "Find where local chemistry becomes collective motion.",
      thesis: "The proximal heme environment and the subunit interfaces offer two competing routes from a local contact to a cooperative state change.",
      opportunity: `Use ${candidateLabel} and an interface site to compare local heme coupling with cross-subunit communication.`,
      program: "Compare deoxy and oxy structural states, identify contacts that change with state, then perturb one heme-linked and one interface-linked site with matched integrity controls.",
      question: "Which contact change is state-linked, perturbable and necessary for cooperative behavior?"
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
  document.getElementById("discoveryModeLabel").textContent = `${mode.toUpperCase()} PROGRAM`;
  document.getElementById("discoveryTitle").textContent = program.title;
  document.getElementById("discoveryThesis").textContent = program.thesis;
  document.getElementById("discoveryOpportunity").textContent = program.opportunity;
  document.getElementById("discoveryProgram").textContent = program.program;
  document.getElementById("discoveryQuestion").textContent = program.question;
  document.getElementById("discoveryGrounding").textContent = discoveryGrounding(report);
  const output = document.getElementById("localSynthesisOutput");
  output.classList.remove("visible");
  output.textContent = "";
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

async function deepenDiscoveryLocally() {
  if (!current) return;
  const button = document.getElementById("localSynthesisButton");
  const output = document.getElementById("localSynthesisOutput");
  const report = current.report;
  const program = buildDiscoveryPrograms(report)[activeDiscoveryMode];
  output.classList.add("visible");
  output.textContent = "Checking for an on-device model in this browser…";
  button.disabled = true;
  try {
    let session = null;
    if (globalThis.LanguageModel?.create) {
      session = await globalThis.LanguageModel.create({ temperature: .2, topK: 8 });
    } else if (globalThis.ai?.languageModel?.create) {
      session = await globalThis.ai.languageModel.create({ temperature: .2, topK: 8 });
    }
    if (!session?.prompt) throw new Error("unavailable");
    const evidence = {
      identity: biologicalGuidance(report).identity,
      metadata: report.metadata,
      chains: report.chainReports.length,
      boundGroups: report.hetero.slice(0, 12),
      candidate: report.topResidues[0],
      comparison: report.controlResidue,
      verifiedPublicAnnotation: report.publicBiology || null,
      selectedProgram: activeDiscoveryMode,
      deterministicProgram: program
    };
    const prompt = `You are extending a protein research brief. Use only the evidence in the JSON below. Do not invent function, disease relevance, binding partners or literature claims. Write three concise sections titled High-value question, Smallest credible program, and Result that changes direction. Explain biological importance in plain language. State uncertainty explicitly. Avoid em dashes. Evidence: ${JSON.stringify(evidence)}`;
    output.textContent = await session.prompt(prompt);
  } catch (_) {
    output.textContent = "No on-device language model is available in this browser. The grounded discovery program above remains active and does not require a model.";
  } finally {
    button.disabled = false;
  }
}

function renderGuidance(report) {
  const candidate = report.topResidues[0];
  const runnerUp = report.topResidues[1];
  const control = report.controlResidue;
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
  const biology = biologicalGuidance(report);
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
  document.getElementById("viewerCandidateReason").textContent = candidate ? (disulfide ? `PROBABLE DISULFIDE · ${disulfide.distance.toFixed(2)} Å TO ${disulfide.label.toUpperCase()}` : `${candidate.degree} NON-LOCAL CONTACTS · ${contactClass.toUpperCase()}`) : "NO RANKABLE CONTACT SIGNAL";
  document.getElementById("hudThesis").textContent = `${biology.identity}. ${biology.siteReason}`;
  document.getElementById("hudMutation").textContent = ladder.conservative;
  document.getElementById("hudMutationNote").textContent = disulfide ? "Disrupts the bridge; treat folding as the first readout." : `Tests ${candidateLabel} with the least severe informative change.`;
  document.getElementById("hudControl").textContent = controlLabel;
  document.getElementById("hudGate").textContent = disulfide ? "INTEGRITY BEFORE FUNCTION" : "CANDIDATE MUST BEAT CONTROL";
  document.getElementById("hudGateNote").textContent = disulfide ? `A functional effect is not site-specific evidence if ${candidateLabel} also loses expression or fold.` : `Advance only if ${candidateLabel} changes the functional readout more than ${controlLabel} without a matching integrity defect.`;
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
  const methods = `Coordinates from ${data.sourceName} were parsed locally with RINet Structure Intelligence 2.1 (receipt ${data.receiptId}). The analyzed model contained ${r.residues} polymer residues and ${r.polymerAtoms} polymer atoms across ${r.chainReports.length} chain${r.chainReports.length === 1 ? "" : "s"}. A deterministic residue-contact graph was constructed between Cα atoms separated by no more than 8.0 Å, excluding residues within two sequence positions on the same chain, yielding ${r.contacts} contacts. Residue priority integrated normalized contact degree, graph reach, distance-weighted packing, long-range and cross-chain contacts, radial burial and proximity to non-water hetero atoms. ${r.disulfides} probable disulfide constraint${r.disulfides === 1 ? " was" : "s were"} assigned from cysteine Sγ separations of 1.7 to 2.3 Å. Coordinate-record screening flagged ${r.chainReports.reduce((s,c)=>s+c.breaks,0)} sequence gap or backbone break${r.chainReports.reduce((s,c)=>s+c.breaks,0) === 1 ? "" : "s"}, ${r.lowOccupancy} polymer atoms below full occupancy and ${r.missingCa} residues without Cα coordinates. B-factor fields were summarized descriptively (mean ${r.bMean === null ? "not available" : r.bMean.toFixed(2)}); they were not assumed to represent prediction confidence. The biological decision brief used explicit rules grounded in supplied PDB metadata, coordinates and graph-derived comparisons. No AI or learned model generated the recommendations.`;
  document.getElementById("methodsText").textContent = methods;
  els.results.classList.remove("hidden");
  document.body.classList.add("analysis-mode");
  document.getElementById("resultScrollCue")?.classList.remove("dismissed");
  preview.stage?.setSpin(false);
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(updateResultScrollCue);
  renderMolecule(data.rawText, data.sourceName, r.topResidues);
}

function buildResultColorScheme(topResidues) {
  if (!window.NGL) return null;
  const targets = new Map(topResidues.map((residue, index) => [`${residue.chain}:${residue.seq}${residue.insertion || ""}`, [0xd9ff58, 0x69d7ff, 0xb98cff, 0xffa95b, 0x62e3bb][index]]));
  const chainPalette = [0x236a78, 0x435fb2, 0x754ca2, 0xb05f36, 0x268568, 0xb08d31];
  return NGL.ColormakerRegistry.addScheme(function () {
    this.atomColor = atom => {
      const chain = atom.chainname || atom.chainid || "∅";
      const key = `${chain}:${atom.resno}${String(atom.inscode || "").trim()}`;
      if (targets.has(key)) return targets.get(key);
      const chainIndex = [...String(chain)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const structuralRegion = Math.max(0, Math.floor((Number(atom.resno || 1) - 1) / 38));
      return chainPalette[(chainIndex + structuralRegion) % chainPalette.length];
    };
  }, "RINet deterministic structure map");
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
    molecular.component.autoView(500);
    molecular.stage.setSpin([0, 1, .06], .00155);
    molecular.spinning = true;
    document.getElementById("viewerSpin").textContent = "Pause";
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
    preview.component.autoView(0);
    preview.stage.setSpin([0, 1, .05], .00125);
    window.addEventListener("resize", () => preview.stage?.handleResize());
  } catch (_) {
    // The launch console remains fully usable if WebGL preview initialization fails.
  }
}

function residueExplanation(residue) {
  if (residue.disulfidePartner) return `PROBABLE DISULFIDE · ${residue.disulfidePartner.distance.toFixed(2)} Å TO ${residue.disulfidePartner.label.toUpperCase()}`;
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
  const comparison = current?.report?.controlResidue;
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
  if (updateDiscovery && current) renderDiscovery(current.report, activeDiscoveryMode);
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
document.getElementById("localSynthesisButton")?.addEventListener("click", deepenDiscoveryLocally);
document.getElementById("viewerFit").addEventListener("click", () => molecular.component?.autoView(450));
document.getElementById("viewerSpin").addEventListener("click", event => {
  if (!molecular.stage) return;
  molecular.spinning = !molecular.spinning;
  molecular.stage.setSpin(molecular.spinning ? [0, 1, .06] : false, .00155);
  event.currentTarget.textContent = molecular.spinning ? "Pause" : "Spin";
});
document.getElementById("newAnalysis").addEventListener("click", () => { window.location.href = "/brief/"; });
document.getElementById("resultScrollCue")?.addEventListener("click", () => document.getElementById("resultScrollCue")?.classList.add("dismissed"));
function updateResultScrollCue() {
  const cue = document.getElementById("resultScrollCue");
  const decisionBrief = document.getElementById("decisionBrief");
  if (!cue || !decisionBrief || !document.body.classList.contains("analysis-mode")) return;
  const guidanceReached = decisionBrief.getBoundingClientRect().top <= window.innerHeight * .82;
  cue.classList.toggle("dismissed", guidanceReached);
}
window.addEventListener("scroll", updateResultScrollCue, { passive: true });
window.addEventListener("resize", updateResultScrollCue, { passive: true });

document.getElementById("copyMethods").addEventListener("click", async e => {
  try { await navigator.clipboard.writeText(document.getElementById("methodsText").textContent); e.currentTarget.textContent = "Copied"; setTimeout(() => e.currentTarget.textContent = "Copy paragraph", 1500); }
  catch (_) { e.currentTarget.textContent = "Select + copy"; }
});

function receiptPayload() {
  return { tool: "RINet Structure Intelligence", version: "2.1", receiptId: current.receiptId, analyzedAt: current.analyzedAt, sourceLabel: current.sourceName, sourceType: current.sourceType, structureSha256: current.digest, summary: current.report, scientificBoundary: "Descriptive coordinate and Cα contact analysis; not functional or causal proof." };
}

document.getElementById("downloadReceipt").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(receiptPayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${current.receiptId.toLowerCase()}-structure-brief.json`; link.click(); URL.revokeObjectURL(link.href);
});

els.receiptForm.addEventListener("submit", event => {
  event.preventDefault(); if (!current || !els.receiptForm.reportValidity()) return;
  const affiliation = document.getElementById("affiliation").value.trim() || "Not provided";
  const researcher = document.getElementById("researcher").value.trim() || "Not provided";
  const feedback = document.getElementById("feedback").value.trim();
  const title = `RINet analysis feedback · ${current.receiptId}`;
  const body = `## RINet analysis feedback\n\n**Affiliation**: ${affiliation}\n**Name / lab**: ${researcher}\n**Receipt**: ${current.receiptId}\n**Input label**: ${current.sourceName}\n**Structure SHA-256**: \`${current.digest}\`\n\n### Message\n${feedback}\n\n### Analysis summary\n- ${current.report.residues} polymer residues across ${current.report.chainReports.length} chain(s)\n- ${current.report.polymerAtoms} polymer atoms\n- ${current.report.contacts} descriptive Cα contacts at 8.0 Å\n- ${current.report.chainReports.reduce((s,c)=>s+c.breaks,0)} sequence gap / backbone break flags\n\n> Coordinates were analyzed locally and are not attached. This receipt records use of the utility; it is not an endorsement of scientific conclusions.`;
  const url = `https://github.com/AkulK08/rinetlab-studio/issues/new?labels=research-use&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

switchSource("id", false);
window.scrollTo({ top: 0, behavior: "auto" });
initPreview();
if (new URLSearchParams(window.location.search).get("demo") === "1") loadDemo();
