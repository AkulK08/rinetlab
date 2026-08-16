# RINet Studio

The public RINet Protein Research Studio site and the zero-install Structure Brief utility.

## Local preview

```bash
python3 -m http.server 8891
```

Then open `http://127.0.0.1:8891/`.

## Included

- Product release: `v1.1.0-build011`
- A black, full-bleed structural evidence scan rendered from the supplied PDB 1CRN.
- Structure Brief: local PDB parsing, coordinate inventory, structural flags, Cα contact summary, methods capsule and private JSON export.
- A checksummed one-line macOS installer.
- The downloadable ZIP contains the CLI-launched local GUI, scientific facilities, tests, checksums, documentation, wheel, and source distribution.

## Production and backup

Production is served from `AkulK08/rinetlab` at `rinetlab.com`. This repository is the separate Studio source requested for the 2026-08-16 redesign.

The complete pre-redesign Git history is mirrored privately at `AkulK08/rinetlab-site-backup-2026-08-16`. The earlier Build 011 rollback branch, annotated tag and bundle also remain intact.
