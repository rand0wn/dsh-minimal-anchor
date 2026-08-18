# Contributing

```bash
npm install
npm run typecheck
npm test
```

`npm test` builds `src/` to `lib/` and runs the unit tests in
`lib/index.test.js` via Node's built-in test runner — no extra test
framework required.

Before opening a PR that changes the tool-pruning or preamble-injection
logic, add or update a case in `src/index.test.ts`; `applyAnchor` is a pure
function specifically so this doesn't require booting a real `dsh` instance.

If you're changing how the plugin hooks into the harness itself (the
`ctx.on('system-prompt/assemble', ...)` call in `apply`), please also
verify it against a real local `dsh` boot — see the README's
[How it works](README.md#how-it-works) section for what "verified" means
here; a type-check alone has previously hidden real breakage (wrong tool
names, an invalid `Config` export shape) that only showed up at runtime.
