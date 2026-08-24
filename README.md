# RINet Scientific Transparency Studio

The public RINet site, zero-install scientific demo, and release channel for the local research app.

## Local preview

```bash
python3 -m http.server 8891
```

Then open `http://127.0.0.1:8891/`.

## Included

- Product release: `v1.3.0-build013`
- A science-first explanation of the method, its intended use, its assumptions, and what it adds beyond a conventional structure viewer.
- Structure Brief: local PDB/mmCIF parsing, author-numbered sequence and structure views, an 8 Å Cα contact network, ten ranked residues, exact per-feature score contributions, matched controls, mutation chemistry, benchmark recovery, cutoff sensitivity, multi-state comparison, and a reproducible JSON/methods export.
- Viewer controls for chain, priority, charge, hydrophobicity, and B-field coloring; black/white backgrounds; explicit rotation and reset controls; and a linked network projection.
- Hypothesis lenses for general, ligand, interface, allostery, stability, and antibody/CDR-aware analysis, with visible caveats when external conservation, dynamics, or energetic evidence is absent.
- A private stored-message contact form on the homepage and Structure Brief, with anonymous institution-count deduplication.
- A checksummed one-line macOS installer.
- The downloadable ZIP contains the CLI-launched local GUI, scientific facilities, tests, checksums, documentation, wheel, and source distribution.

## Production and backup

Production is served from `AkulK08/rinetlab` at `rinetlab.com`.

The verified pre-Build-013 repository backup is stored separately from this working repository. Earlier rollback branches and release artifacts remain intact.
