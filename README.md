# rinetlab.com

Static GitHub Pages site for RINet Protein Research Studio.

## Local preview

```bash
python3 -m http.server 8891
```

Then open `http://127.0.0.1:8891/`.

## Build 011 release

- Product release: `v1.1.0-build011`
- The homepage video is a real capture of the locally running Build 011 NGL workspace.
- The downloadable ZIP contains the CLI-launched local GUI, scientific facilities, tests, checksums, documentation, wheel, and source distribution.

## Rollback

The production state immediately before the Build 011 redesign is preserved at both:

- branch `backup/site-pre-build011-2026-08-16`
- annotated tag `site-pre-build011-2026-08-16`

To restore it, create a new branch from the tag, review it, then merge or reset `main` through the normal GitHub workflow.
