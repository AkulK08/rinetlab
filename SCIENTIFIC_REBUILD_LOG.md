# RINet scientific rebuild log

Last updated: 2026-08-25

## Objective

Make RINet useful to a working protein researcher without presenting a residue contact graph as an energetic model, a mechanism, or evidence that information flows through a protein. The product should move from a coordinate model to a residue-level experiment that can disconfirm its own structural rationale.

This file is the handoff point for future work. Read it before changing the scoring, scientific language, or experiment-selection logic.

## Criticism this rebuild addresses

Rama's central objection was that contacts do not establish the net free energy of amino-acid interactions, and that a contact graph is not by itself a sound basis for claiming information flow in proteins.

The response implemented here is not to rename contact scores as energy. RINet now separates three layers:

1. **Observed local geometry:** typed heavy-atom contacts, atom names, partners, and distances from the supplied coordinate model.
2. **Wider structural position:** a separate Cα graph and explicitly weighted graph descriptors.
3. **Experimental test:** a candidate mutation, a local-environment-matched lower-graph control, function plus protein-quality measurements, and a stopping rule.

If candidate and control behave similarly, the workflow explicitly reports that the graph-position hypothesis was not supported. If function changes while abundance and fold/assembly remain intact and the control has less effect, the site becomes a stronger experimental hypothesis. Neither outcome is labelled proof of a mechanism.

## What the literature says

The research review used primary method papers and project documentation.

- RING 2.0 and RING 3.0 establish residue interaction networks with typed physicochemical interactions, all-atom options, and ensemble/frequency information. This means typed interaction networks are established prior art, not a RINet invention.
  - https://doi.org/10.1093/nar/gkw315
  - https://doi.org/10.1093/nar/gkac365
- Arpeggio establishes atom typing plus geometric rules for classifying protein, ligand, and metal contacts. The RINet browser audit follows this established concept with simpler disclosed rules.
  - https://doi.org/10.1016/j.jmb.2016.12.004
- NAPS shows that residue-network construction, centrality analysis, and distance/energy network variants are established.
  - https://doi.org/10.1093/nar/gkw383
- FoldX and localized-frustration work show why mutation and energetic claims require an energy model, structural relaxation/decoys, and careful error interpretation. Geometry alone is insufficient for ΔG.
  - https://doi.org/10.1093/nar/gkh332
  - https://doi.org/10.1073/pnas.0709915105

## What is implemented in Structure Brief 3.1

### 1. Browser-local atom-level evidence

Polymer heavy atoms are indexed in spatial cells. For every residue, the interface reports mutation-relevant side-chain partners and retains the exact atom pair and minimum observed distance.

Displayed rules:

- heavy-atom contact: at most 4.5 Å
- polar N/O/S proximity: 2.35–3.60 Å
- ionic geometry: oppositely charged Asp/Glu and Arg/Lys side-chain atoms at most 4.0 Å
- hydrophobic side-chain C/S contact: 3.0–4.6 Å
- aromatic ring-atom proximity: 3.2–5.5 Å
- cysteine Sγ pair: 1.7–2.3 Å
- polymer–hetero contact: at most 4.5 Å
- ligand polar proximity: at most 3.6 Å
- N/O/S-to-metal proximity: at most 3.0 Å

The UI deliberately says “polar proximity,” not “hydrogen bond,” because hydrogens and angular geometry are not evaluated. It says “aromatic proximity,” not stacking energy. Protonation, solvent, relaxation, and energy are not calculated.

### 2. Mutation-specific capability audit

For the selected first mutation, RINet identifies which broad side-chain capabilities are preserved, removed, or geometrically changed. Examples include charge, polarity, aromaticity, hydrophobic packing, disulfide sulfur, and imidazole coordination geometry.

This is a transparent capability comparison, not a predicted mutant structure or ΔΔG. The UI states that a retained capability does not guarantee retention of the original contact.

### 3. Chemistry-aware residue ranking

All six scientific questions now combine disclosed atom-level features with the existing graph and structural-context features. The exact equation and per-residue contribution remain visible. Each question's weights sum to 1.0.

New score terms:

- typed side-chain atomic partners
- polar-contact geometry
- ionic-contact geometry
- direct ligand/metal partners

Existing Cα features remain visible and are explicitly labelled as Cα graph descriptors.

### 4. Local-environment-matched graph falsification control

This is the most important scientific change.

For a selected candidate, RINet searches lower-scoring residues and minimizes a matching penalty based on:

- residue chemistry class
- typed atomic-partner profile
- polar and ionic context
- direct ligand/metal context
- bound-group distance and metal flag
- burial
- B-factor field
- chain context
- absence of a disulfide constraint

Controls within three sequence positions are excluded. Among credible local matches, RINet favors a lower Cα-graph contribution. The output reports:

- local-environment match quality
- candidate versus control atomic-partner counts
- polar and bound-group counts
- burial comparison
- exact difference in weighted graph points
- largest term-by-term score differences

The experiment sheet states the falsification rule: if candidate and control behave alike, the graph-position rationale is not supported.

### 5. Complete residue-to-experiment cycle

The main path remains:

1. Question
2. Candidate
3. Matched control
4. Function, abundance, and fold/assembly measurements
5. Specific-effect versus protein-quality interpretation
6. Next construct chosen to distinguish the remaining explanations

The built-in 4HHB example values are synthetic and labelled as such.

### 6. Visual and language cleanup

- The results page is now a continuous dark surface; the previous white scientific, sequence, and prior-art blocks are dark.
- The optional white molecular-viewer background remains available for figure preparation.
- Atom-level evidence appears directly beneath the selected residue plan.
- Prior art is named in the interface rather than being implied to be new.
- The expert table now exposes atomic, polar, and ionic counts.

## Defensible novelty statement

Do **not** claim that RINet invented residue graphs, graph centrality, typed atomic contacts, mutation hot-spot ranking, or active learning. Those areas have substantial prior art.

The contribution being tested is the integrated workflow:

> RINet turns one structure into an inspectable candidate mutation and a local-environment-matched control that directly tests whether wider graph position adds experimental value, then uses function and protein-quality measurements to classify the result and choose the next discriminating construct.

This is presently a workflow and experimental-design contribution. It is not yet a validated predictive breakthrough. The interface says that prospective performance has not been established.

## Validation performed in this phase

- JavaScript syntax check passes.
- Patch whitespace check passes.
- All six question lenses sum to exactly 1.0 and were exercised in the local browser.
- The built-in 4HHB demo loads successfully.
- Top candidates, matched controls, atom counts, and mutation audits update when a residue or question is changed.
- The heme-coordinating HIS A:87 example exposes NE2–FE at 2.14 Å and identifies that H→N changes imidazole coordination geometry.
- The local-environment control displays its match score and graph-point contrast.
- Desktop and 390 × 844 phone-viewport visual reviews confirm a continuous dark results page and readable stacked interaction/mutation panels.

## Scientific work still required before strong performance claims

The following is a validation program, not optional copy polish:

1. Freeze an external benchmark before tuning. Include experimentally established catalytic, ligand-contact, interface, allosteric, antibody CDR/antigen-contact, and null residues.
2. Compare against simple baselines: solvent exposure, distance to ligand, degree, conservation alone, and random matched residues.
3. Compare against established tools where licensing and reproducibility permit: RING/Arpeggio contact evidence, FoldX/Rosetta stability estimates, evolutionary scores, and MD/ensemble methods.
4. Report top-k recall, enrichment, calibration where applicable, protein-family splits, and failure cases. Do not tune and report on the same proteins.
5. Test the matched-control design prospectively. The key question is whether candidate–control separation exceeds candidate-only selection and simple baselines.
6. Measure sensitivity to structure state, biological assembly, missing atoms, protonation, alternate conformers, cutoffs, and chain mapping.
7. Add a real energy/relaxation layer only as a separately named external calculation. Never infer ΔG from contact counts.
8. Add conservation only from an explicit sequence analysis with accession, database version, alignment settings, and exportable provenance.

## Resume checklist

1. Open `/Users/me/rinetlab`.
2. Read this file and inspect the latest commits on `main`.
3. Run the local site and open `/brief/?demo=1`.
4. Exercise all six structural questions and select at least one ligand/metal residue and one ordinary residue.
5. Keep the homepage unchanged unless the user explicitly requests another homepage edit.
6. Before changing any scientific claim, classify it as: directly observed geometry, calculated descriptor, model output, external annotation, or experimental result.
7. Update this log whenever a scoring term, cutoff, control-matching rule, benchmark, or public novelty statement changes.

## Files changed in this phase

- `brief/index.html`
- `brief/brief.css`
- `brief/brief.js`
- `SCIENTIFIC_REBUILD_LOG.md`
