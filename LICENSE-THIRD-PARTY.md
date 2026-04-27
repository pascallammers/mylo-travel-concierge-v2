# Third-Party Licenses

This project includes third-party software, which is distributed under its own licenses. We acknowledge and are grateful to these developers for their contributions.

## borski/travel-hacking-toolkit

- **Path:** `lib/data/borski-toolkit/` (git submodule)
- **Source:** https://github.com/borski/travel-hacking-toolkit
- **License:** MIT License
- **Copyright:** (c) 2026 Michael Borohovski

Used as a structured-data source for transfer partners, sweet spots, points valuations, partner award charts, alliance memberships, and hotel-chain metadata. The toolkit's MCP servers, skills, and Docker images are referenced for documentation purposes but are not redistributed.

### MIT License Compatibility

The MIT License is compatible with this project's commercial SaaS distribution. Attribution is provided here. The full upstream LICENSE text is preserved in `lib/data/borski-toolkit/LICENSE`.

### Sync Policy

The submodule is pinned to a specific commit. To pull upstream updates manually:

```bash
cd lib/data/borski-toolkit
git fetch origin
git checkout origin/main
cd ../../..
git add lib/data/borski-toolkit
git commit -m "chore(borski-toolkit): sync to upstream <hash>"
```

Recommended cadence: quarterly review (mileage program devaluations and chart changes are frequent).
