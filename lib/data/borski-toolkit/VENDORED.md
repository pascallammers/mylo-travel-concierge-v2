# borski-toolkit (vendored)

Snapshot of the public `borski/travel-hacking-toolkit` data files used by
`lib/data/borski-toolkit-adapter/`. Vendored on 2026-05-11 from commit
of the upstream `data/` directory.

## Files

Only the JSON data files that `load-from-borski.ts` imports are kept:

- `data/alliances.json`
- `data/hotel-chains.json`
- `data/partner-awards.json`
- `data/points-valuations.json`
- `data/sweet-spots.json`
- `data/transfer-partners.json`

## Why vendored

Previously a git submodule pointing at `github.com/borski/travel-hacking-toolkit`.
Runtime imports made the production build depend on third-party repo
availability and untracked content updates. Vendoring eliminates that
supply-chain dependency.

## Update process

To pull newer upstream data:

1. Clone `https://github.com/borski/travel-hacking-toolkit.git` somewhere temporary
2. Diff `data/*.json` against this directory
3. Cherry-pick changes you want, commit with a clear message
4. Run `pnpm test lib/data/borski-toolkit-adapter/` to verify schemas still match

Do not auto-pull. Each refresh should be a reviewed PR.

## License

Upstream is published under the `LICENSE` file in this directory. We do not
modify the JSON content; we only re-host the snapshot we depend on.
