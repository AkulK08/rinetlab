# RINet scientific feedback implementation matrix

This is the acceptance contract for the 2026-08-24 scientific rebuild. It preserves every distinct suggestion in the supplied reviewer emails and form responses, including repeated requests where repetition indicates priority.

## 1. Scientific purpose and positioning

1. Replace sales-led copy with a scientist-to-scientist explanation of the problem RINet solves.
2. State the primary use case plainly: RINet is a hypothesis triage and experiment-design layer for a supplied structure, not a functional oracle.
3. Answer “what does this add beyond a structural biologist's daily tools?” with an explicit comparison: a conventional viewer shows coordinates; RINet produces a traceable candidate-versus-control experiment, sensitivity analysis, competing explanations, and a reproducible decision record.
4. Add worked vignettes that show how the method can address structure-based questions, including allostery/state change, GPCR-like activation questions, host–pathogen interfaces, ligand/drug-site hypotheses, protein engineering, antibodies, and variant interpretation.
5. Preserve the graph-theoretic description for expert users while adding an explanation from the experimental user's perspective.
6. Write for knowledgeable scientists. Define specialist terms, but do not reduce the scientific content to slogans.
7. Present RINet as hypothesis generation and prioritization, never as proof of function, allostery, mechanism, druggability, disease relevance, or biological causality.

## 2. Transparent residue ranking

8. Show exactly why each recommended residue was selected instead of other possible residues.
9. Replace generic mutation prose with residue-specific evidence: graph metrics, structural neighborhood, ligand distance, interface contacts, burial, data quality, and score contributions.
10. Show the complete scoring equation, weights, normalization, graph construction assumptions, and deterministic tie-breaking.
11. Show each feature's numerical contribution to each residue's final score.
12. Provide 5–10 ranked residues rather than a single answer.
13. Make every ranked residue clickable in the structure and sequence.
14. Explain degree centrality, closeness centrality, betweenness/path centrality, long-range contacts, weighted packing, and cross-chain contacts in structural-biology terms.
15. Explain that degree and closeness can correlate with geometric centrality or dense active-site packing, and therefore are not automatically functional or allosteric evidence.
16. Remove any accidental cysteine preference. A cysteine only receives a disulfide feature when an Sγ–Sγ geometry supports a probable disulfide; the UI must show that contribution and its structural-risk interpretation.
17. Validate residue identifiers against parsed coordinate records before displaying or exporting them; never invent a chain/residue pair such as the reported ASN B658 failure.
18. Distinguish author chain/numbering from missing or ambiguous coordinate identifiers, and visibly flag insertion codes and coordinate gaps.
19. Match controls by residue chemistry, burial, local data quality, and chain context while requiring a deliberately weaker primary network signal; show the match quality.

## 3. Mutation rationale

20. Explain why a specific substitution is proposed and how it changes size, charge, hydrogen-bonding, aromaticity, flexibility, or disulfide chemistry.
21. Label substitutions as conservative, property-neutralizing, or stress/second-step perturbations.
22. Do not imply that a sequence-conservative substitution is structurally conservative in every context.
23. For N→Q specifically, explain that it preserves an amide while adding one methylene, probing side-chain reach and geometry; do not claim a functional effect from that fact alone.
24. Pair every proposed mutation with integrity gates (expression/abundance and folding/stability) before a function readout is interpreted.

## 4. Validation and benchmarking

25. Add a benchmark view against experimentally established functional, ligand-contact, interface, allosteric, or mutationally sensitive residues.
26. Show known-site recovery as rank/percentile, not a vague success claim.
27. Separate curated known sites from algorithm output so the benchmark cannot leak labels into the ranking.
28. Compare, or clearly expose future comparison hooks for, mutational data, evolutionary conservation, MD/state analysis, and established structure-based methods.
29. Report the present validation level honestly, including the difference between an in-demo sanity check and systematic external validation.
30. Add ranking sensitivity analysis for contact cutoff and score assumptions; report rank stability rather than hiding parameter dependence.
31. Add multi-state comparison so two conformations of the same protein can be compared for contact/rank changes and candidate gain/loss.
32. Do not overstate residue-level graph descriptions as adequate for atomistic folding, energy, kinetics, or structure prediction.

## 5. Biological and sequence context

33. Add a sequence strip alongside the structure, grouped by chain, with selected and ranked residues synchronized.
34. Add optional conservation evidence and make its source/status explicit; do not silently invent conservation when no sequence search has been run.
35. Provide a route to BLAST/evolutionary analysis while keeping structure-only ranking valid when those data are absent.
36. Let users state a biological hypothesis or analysis lens so prioritization can be tailored to ligand sites, interfaces, allostery, stability/engineering, antibodies, or general exploration.
37. For antibodies, detect antibody-like annotations, expose CDR-aware analysis, distinguish heuristic numbering from validated CDR annotation, and prioritize CDR/antigen-interface evidence over framework-only results when appropriate.
38. Preserve accurate high-level PDB descriptions but cite/label public annotations separately from inferences.
39. Handle newly deposited structures robustly by trying PDB and then mmCIF endpoints, and provide local-file fallback with a precise error.

## 6. Visualization and usability

40. Color by chain by default and show a visible legend.
41. Add explicit color modes for chain, RINet priority, charge, hydrophobicity, and B-factor/confidence field.
42. Explain what every color scheme means and avoid decorative coloring with no scientific meaning.
43. Start automatic rotation off. The control must say “Start rotation” rather than requiring users to discover how to stop it.
44. Add an obvious “Reset view” action that restores the full structure after residue focus.
45. Add black and white viewer backgrounds for analysis and figure preparation.
46. Remove distracting or gun-like icons; use labeled scientific controls.
47. Increase minimum text size/contrast and retain readable light/dark presentation.
48. Add an interpretable residue-interaction-network embedding/projection linked to the 3D structure and ranked residue list.
49. Preserve a less-restrictive expert path: full ranked table, filters/lenses, methods, raw metrics, export, CLI/API continuity, and no forced guided tour.

## 7. Reproducibility, limits, and deliverables

50. Export a methods-ready record containing source checksum, exact parameters, score weights, residue identifiers, all feature contributions, ranking, controls, benchmark status, and caveats.
51. Keep uploaded coordinates local; clearly distinguish local parsing from RCSB/annotation requests.
52. Remove optional generative-AI prose from the scientific result so the no-AI claim is unambiguous.
53. Add a concise limitations panel covering static structures, construct/numbering mismatch, unresolved atoms, alternate conformers, biological assembly choice, crystal contacts, coarse residue graphs, absent evolutionary evidence, and absent dynamic/energetic evidence.
54. Keep the web demo and installed app scientifically consistent: same labels, default parameters, scoring equation, evidence display, controls, and export schema.
55. Test the named reviewer structures where available: 4HHB, 5CFO, 5DTL, 7YUE, and the recently deposited 9XU3/fallback path.

## Definition of done

Every item above must be represented by working behavior, explicit scientific documentation, or an honest status/limitation that prevents the interface from implying unsupported capability. “Planned” language is not considered an implementation for core analysis, ranking transparency, viewer controls, sequence context, parameter sensitivity, or export provenance.
