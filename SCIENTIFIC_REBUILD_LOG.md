# RINet scientific rebuild log

Last updated: 2026-08-25

## Current objective

RINet should take a structural-biologist's question—"what site do I care about, which mutation should perturb it, and what control would make the result interpretable?"—and turn it into a traceable experiment. It must not present contact centrality as a molecular mechanism or hide assumptions behind prose.

This file is the continuation log. Read it before changing the scientific calculation, ranking, validation panels, or public novelty statement.

## The criticism being addressed

Rama's central concern was scientific, not stylistic:

- residue networks and centrality are established;
- a residue contact graph does not establish energetic communication or information flow;
- a useful contribution requires experimentally meaningful validation, comparison with baselines and existing methods, and sensitivity analysis;
- experienced structural bioinformaticians need access to targets, parameters, complete rankings, sequence mapping, and alternative states rather than a single guided answer.

The rebuild therefore changes the architecture. The primary ranking is no longer contact degree, betweenness, closeness, or an unexplained weighted sum of graph descriptors.

## Implemented scientific architecture

The implemented method is named **RINet Targeted Mechanochemical Contrast (TMC) 1.0**. The name identifies an integration being tested; it is not a claim of prospective validation.

### 1. The researcher defines a physical target

The calculation begins with the place where a perturbation should be measured:

- a combined set of equivalent ligand pockets;
- an individual ligand or metal pocket;
- a chain interface resolved from cross-chain atom contacts; or
- user-entered author residue identifiers such as `A:87, A:92`.

Changing the target rebuilds the mechanical model and reranks every residue. The functional assay is entered separately because the assay changes the experiment sheet, not the structure calculation.

For the built-in 4HHB demo, the default target is **All HEM pockets** (83 resolved target residues), which matches a global oxygen-equilibrium or heme-spectral experiment better than one arbitrarily selected heme.

### 2. Three-dimensional anisotropic elastic network

RINet builds a Cα anisotropic network with uniform harmonic springs for pairs separated by no more than 8.5 Å. It also repeats the complete calculation at 8.0 and 9.0 Å.

The regularized linear system is:

`(H + λI)u = fT`

where `H` is the 3N × 3N anisotropic-network Hessian. Net-zero forces load the selected target against the remaining network along x, y, and z. Each system is solved with diagonally preconditioned conjugate gradients. The interface exposes node count, spring count, ridge, maximum residual, and all three cutoffs.

Research basis:

- anisotropic network model: https://doi.org/10.1016/S0006-3495(01)76033-X
- perturbation-response scanning: https://pmc.ncbi.nlm.nih.gov/articles/PMC2913187/
- PRS applications to allosteric response: https://pmc.ncbi.nlm.nih.gov/articles/PMC3188487/
- ENM cutoff evaluation supporting an 8.5 Å balance: https://doi.org/10.1016/j.jmb.2022.167696

### 3. Primary output: first-order target-compliance sensitivity

The primary mechanical value is not centrality and is not the normalized cross-compliance descriptor.

For spring `e=(p,q)` with unit direction `ne`, target-load extension is:

`δe = ne · (up − uq)`

For residue `i`, RINet sums strain energy over springs incident to that residue and averages the three target-load directions:

`Si(T) = Σe∋i meanx,y,z(δe²)`

If the local springs incident to residue `i` are weakened by a small fraction `ε`, the first-order target-compliance change is:

`ΔJtarget ≈ ε Si(T)`

with:

`Jtarget = fT (H + λI)^−1 f`

This gives the experimental ranking a direct interpretation: the higher the value, the more the selected target's mechanical compliance is expected to change under a small local loss of stiffness at that residue in this near-native linear model.

Structural compliance derivatives and spring-sensitivity analysis are established ideas in mechanics and protein elastic-network analysis. RINet's contribution being tested is their target-specific, mutation-audited, candidate-control integration—not invention of the underlying mathematics.

Related evidence:

- structural compliance and allosteric communication: https://pmc.ncbi.nlm.nih.gov/articles/PMC7649752/
- spring perturbations for allosteric sites: https://pubmed.ncbi.nlm.nih.gov/35778086/
- elastic-network perturbation and allosteric control: https://pmc.ncbi.nlm.nih.gov/articles/PMC5873042/
- AlloPred elastic-network perturbation: https://pmc.ncbi.nlm.nih.gov/articles/PMC4619270/

### 4. Robustness and supporting descriptors

Sensitivity robustness is:

`1 / (1 + coefficient of variation)`

across 8.0, 8.5, and 9.0 Å. The UI also reports top-10 site overlap and the selected candidate's sensitivity rank at every cutoff.

Normalized target-region cross-compliance is retained as a supporting response descriptor. Centrality, packing, interface contacts, and bound-group distance remain visible and receive small or question-specific score weights; none is represented as evidence of causal information flow.

### 5. Mutation-specific local constraint audit

The proposed substitution is checked against explicit side-chain-involving atom contacts. The interface shows the observed atom pair, partner, type, and distance, then states which broad side-chain capabilities the substitution retains, loses, or changes.

Rules are disclosed:

- heavy-atom contact: at most 4.5 Å;
- polar N/O/S proximity: 2.35–3.60 Å;
- opposite-charge side-chain geometry: at most 4.0 Å;
- hydrophobic C/S contact: 3.0–4.6 Å;
- aromatic atom proximity: 3.2–5.5 Å;
- metal-donor proximity: at most 3.0 Å;
- probable disulfide Sγ pair: 1.7–2.3 Å.

This layer estimates mutation constraint leverage. It is not ΔΔG and does not relax a mutant structure.

### 6. Construct-level assembly handling

Identical-sequence chain copies are collapsed into a single construct-level site. Sensitivity is summed across equivalent copies, and highlighting selects all equivalent residues in 3D.

For 4HHB, this produces 287 independently rankable construct positions rather than pretending that the 574 coordinate-chain residues can be mutated independently. Labels such as `ARG A/C:141` and `ASP B/D:99` make the construct scope explicit.

### 7. Matched low-sensitivity control

For every candidate, RINet searches for a lower-sensitivity mutation matched on:

- the same wild-type amino acid and therefore the same proposed substitution when possible;
- side-chain atomic partners;
- polar, ionic, ligand, and metal contact context;
- burial;
- B-factor field;
- chain context; and
- absence of a disulfide constraint.

The selected control must have substantially lower first-order target-compliance sensitivity. One shared control-matching implementation is used in the selected-residue plan and multi-construct panel, so match quality and sensitivity ratio do not differ across screens.

The decision rule is candidate-minus-control, with abundance and fold/assembly gates. Similar candidate and control outcomes count against the target-sensitivity explanation.

### 8. Experiment and next-experiment loop

The visible workflow is:

1. Question: choose the functional target and readout.
2. Candidate: select a high-sensitivity residue and substitution.
3. Control: use a locally matched lower-sensitivity mutation.
4. Measurements: function, abundance, and fold/assembly for every construct.
5. Interpretation: classify a specific functional contrast, protein-quality confound, unresolved contrast, or no effect.
6. Next experiment: increase mutation severity at a supported site, select a different local environment after a quality confound, or test the next independent high-sensitivity site.

The built-in demo results are synthetic, already filled, and visibly labelled as interface demonstration data rather than 4HHB measurements.

### 9. Validation machinery

The demo now contains four distinct checks:

1. **Post-ranking 4HHB anchors.** Known labels do not enter the score. The default 4HHB result ranks `ARG A/C:141` first. αArg141→Ser has experimentally observed high oxygen affinity and reduced cooperativity and is implicated in T-state stabilization and the Bohr effect (PMID 7338473). `ASP B/D:99`, the Hb Kempsey site, is shown separately; βAsp99→Asn produces high oxygen affinity and markedly reduced cooperativity (PMID 1427427). Proximal heme histidines check coordinate/ligand assignment.
2. **Cutoff challenge.** Full target sensitivity is repeated at 8.0, 8.5, and 9.0 Å.
3. **Second-conformation import.** A second PDB/mmCIF can be compared using exact author identifiers, target sensitivity, degree, and rank shifts.
4. **Lab benchmark CSV.** Researchers can import `chain,residue,insertion,known_functional` labels. With explicit positives and negatives, RINet calculates AUROC for the complete score, target sensitivity, target distance, and Cα degree. Optional `conservation_score`, `md_score`, and `external_score` columns are evaluated beside them. It also reports resolved labels, top-10 positive recovery, and enrichment. Unlabelled residues are never silently treated as negatives.

Relevant benchmark literature:

- bond-to-bond propensity and allosteric-site evaluation: https://pmc.ncbi.nlm.nih.gov/articles/PMC5007447/
- scalable bond-propensity analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC6056424/
- allosteric-site benchmark comparison: https://pmc.ncbi.nlm.nih.gov/articles/PMC8767309/
- ASBench: https://academic.oup.com/bioinformatics/article/31/15/2598/188062
- CASBench: https://pmc.ncbi.nlm.nih.gov/articles/PMC6475866/

The 4HHB recovery is a retrospective anchor, not general validation. The imported-label evaluator is benchmarking machinery, not a substitute for a frozen multi-protein test set.

### 10. Large-assembly policy

For structures above 1,400 residues, the interactive mechanical domain is restricted to the 1,400 residues nearest the selected target. Excluded residues receive no mechanical rank. This scope is disclosed in the target panel and exported methods. A production backend should support sparse factorization for complete assemblies rather than relying on this browser-time cap.

## Defensible novelty statement

Do not claim that RINet invented residue networks, centrality, elastic-network models, perturbation-response scanning, dynamic coupling, spring sensitivity, or mutation ranking.

The contribution being implemented and tested is:

> RINet starts from a user-selected functional site, calculates the first-order change in that site's compliance under local residue-level weakening, audits an experimentally interpretable substitution against observed atom contacts, and generates a locally matched low-sensitivity mutation that directly challenges the mechanical explanation. The same workflow interprets function, protein quantity, and fold/assembly results and selects the next discriminating construct.

This is materially different from returning a list of "important residues." It makes a target-specific quantitative prediction and supplies the control required to test whether that prediction adds value beyond local chemistry and generic protein damage.

It is not yet defensible to call the method a validated breakthrough or to assign a business valuation. That requires held-out prospective performance.

## Current 4HHB demonstration result

- target: All HEM pockets, 83 target residues;
- model: 574 Cα nodes, target-loaded 3D anisotropic network, three cutoffs;
- independently rankable construct positions: 287;
- top default candidate: `ARG A/C:141`, `R→K` first probe;
- matched control: `ARG A/C:92`, also `R→K`;
- control local-environment match: approximately 89/100;
- control target-compliance sensitivity: approximately 46% of the candidate;
- required experiment: oxygen-equilibrium or heme-spectral function, protein abundance, and fold/tetramer integrity in the same batch;
- interpretation: candidate function must differ from control while protein quality remains acceptable.

Values should be rechecked after any change to target definition, spring construction, target force convention, construct grouping, score weights, or control matching.

## QA completed in this phase

- JavaScript syntax check passes.
- Patch whitespace check passes.
- The built-in 4HHB demo loads locally and shows the whole molecule on desktop and 390 × 844 mobile viewports.
- Rotation start/stop, reset view, surface/cartoon representation, chain/priority color, black/white background, residue selection, 3D focus, and experiment-sheet dialog were exercised.
- All six scientific questions recalculate and return a candidate/control pair.
- Combined heme, individual heme, and manual residue targets recalculate the networks and ranking.
- Manual targets no longer duplicate the residue count in the selector label.
- The section indicator displays 1/5 through 5/5 and the original scroll cue is present.
- Every workflow card now presents the scientific question first and its current target, construct, measurement, interpretation, or next experiment underneath; candidate and control answers no longer replace the question headline.
- The visible page contains none of the previous "working models," "model fit," "model separation," or hand-set mechanism-pattern language.
- The homepage is not modified by this rebuild; `/brief/` and `/brief/?demo=1` share the rebuilt app code.

## Work still required before strong performance claims

1. Freeze a multi-protein benchmark before any further weight tuning. Use family-separated train/development/test partitions.
2. Include experimentally characterized functional, catalytic, interface, allosteric, antibody, stability-sensitive, and null residues.
3. Compare against distance to target, solvent exposure, degree, conservation, random matched controls, FoldX/Rosetta stability estimates, bond-propensity methods, MD/ensemble response, and available mutational-effect predictors.
4. Report AUROC/AUPRC when negatives are valid, top-k recall, enrichment, uncertainty, protein-family stratification, cutoff/state sensitivity, and every failure case.
5. Prospectively test whether the matched-control contrast outperforms candidate-only selection and simple baselines.
6. Add biological-assembly verification, protonation/alternate-state handling, and explicit biological unit selection.
7. Add a separate mutant-relaxation/energy layer only with method/version/provenance; never convert contact counts into ΔΔG.
8. Add conservation only from an explicit alignment with database release and parameters.
9. Replace the browser large-domain cap with a sparse backend for very large complexes.
10. Publish benchmark protocols and frozen outputs before claiming general predictive value.

## Resume checklist

1. Open `/Users/me/rinetlab` and read this file.
2. Inspect the latest commit on `main` and run `/brief/?demo=1` locally.
3. Confirm the default target is All HEM pockets and the first candidate remains `ARG A/C:141` unless an intentional method change explains otherwise.
4. Exercise all six scientific questions, one individual ligand target, and a manual target.
5. Verify the same control match appears in the selected plan and multi-construct panel.
6. Test desktop and 390 × 844 layouts; reset any temporary browser viewport afterward.
7. Keep the homepage unchanged unless the user explicitly requests a homepage edit.
8. Classify every public statement as observed coordinate evidence, calculated model output, external annotation, or experimental result.
9. Update this log whenever the force convention, Hessian, spring cutoff, sensitivity derivative, construct grouping, score weights, control logic, benchmark, or novelty statement changes.

## Files changed in this phase

- `brief/index.html`
- `brief/brief.css`
- `brief/brief.js`
- `SCIENTIFIC_REBUILD_LOG.md`
