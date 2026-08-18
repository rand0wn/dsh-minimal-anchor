# dsh-minimal-anchor

[![CI](https://github.com/rand0wn/dsh-minimal-anchor/actions/workflows/ci.yml/badge.svg)](https://github.com/rand0wn/dsh-minimal-anchor/actions/workflows/ci.yml)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that shields turn 1 from tool-schema overload.

## Why

A fresh `dsh` session hands the model the *entire* configured toolset — file
edits, bash, subagents, jobs — on message one, even when the first message is
just "look at this repo and tell me what's going on." A smaller, focused
schema on that first turn keeps the model's early reasoning on exploration
instead of premature action, without touching how any later turn behaves.

`dsh-minimal-anchor` hooks the harness's own prompt-assembly pipeline to:

1. **Prune tools on turn 1 only** — down to a configurable whitelist (default: `read`, `glob`, `grep`).
2. **Prepend a short structural preamble** on that same turn, framing the session as exploration-first.
3. **Get out of the way from turn 2 onward** — every later assembly for that session passes through completely untouched, full toolset restored.

## Install

```bash
dsh plugin --profile <name> add dsh-minimal-anchor
```

or from a local checkout:

```bash
dsh plugin --profile <name> add /path/to/dsh-minimal-anchor
```

This adds the package as a dependency of the profile, but does **not** by
itself activate it — `dsh` only applies a package's `dsh.bundle` patch for
packages listed in that profile's `dsh.profile.bundles`. Add the package
name to that list in `profiles/<name>/package.json`:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-headless",
        "dsh-minimal-anchor"
      ]
    }
  }
}
```

Confirm it composed with `dsh --profile <name> --dump-config` — you should
see a `minimal-anchor` entry. (An equivalent alternative that skips the
bundles list entirely: insert it directly in your own
`profiles/<name>/cordis.patch.yml` — see [Configuration](#configuration).)

## Usage

Nothing to invoke — it's a passive plugin. Boot your profile as usual
(`dsh web`, `dsh --profile headless "..."`, etc.) and the first turn of every
new session goes out with the pruned tool list and preamble automatically.

## Configuration

```yaml
# profiles/<name>/cordis.patch.yml
- insert:
    - id: minimal-anchor
      name: 'dsh-minimal-anchor'
      config:
        whitelistedTools: [read, glob, grep]
        enforcePreamble: true
        customPreamble: 'Your own turn-1 framing text.'
```

| Field | Default | Description |
| --- | --- | --- |
| `whitelistedTools` | `[read, glob, grep]` | Tool names kept on turn 1. Must match the exact registered tool names in your profile — check `dsh --profile <name> --dump-config` if unsure, names differ from plugin to plugin. |
| `enforcePreamble` | `true` | Whether to prepend the structural preamble section on turn 1. |
| `customPreamble` | (built-in exploration-framing text) | Preamble text, used only when `enforcePreamble` is `true`. |

Extending rather than replacing the default whitelist? `DEFAULT_WHITELISTED_TOOLS`
and `DEFAULT_PREAMBLE` are exported from the package if you're composing config
in TypeScript rather than YAML.

## How it works

Hooks the `system-prompt/assemble` waterfall from
[`@deepseek-ai/dsh-system-prompt`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/system-prompt),
which runs once per turn and produces the `PromptAssembly` (sections, tools,
contexts) actually sent to the model. A `WeakSet` keyed on the assembly's
scope tracks whether that scope has assembled before; the first time, it
filters `assembly.tools` to the whitelist and unshifts the preamble section,
then calls `next()` so every other listener in the waterfall still runs
normally. Every later assembly for that scope short-circuits straight to
`next()` — no mutation, no persisted per-session state beyond the WeakSet
entry, which needs no explicit teardown since it dies with the scope object.

There is no `agent/request` or per-message hook in the real harness — this
plugin does not use one, unlike an earlier draft of this same idea that
assumed events that don't exist in `dsh`.

## Troubleshooting

**Turn 1's tool list came back empty.** `whitelistedTools` matches on the
exact registered tool name — these differ per harness install and per other
plugins you have active. Check the real names with
`dsh --profile <name> --dump-config`, or open the Trajectory tab in the web
UI for a session and look at the Tools panel on "Initial System Prompt". An
early draft of this plugin shipped with guessed names (`read_file`,
`list_dir`, `search_files`) that don't exist in the real harness — the
whitelist silently matched nothing and pruned every tool.

**Plugin doesn't seem to load / no `minimal-anchor` entry in `--dump-config`.**
Being a listed `dependency` of the profile (e.g. after `dsh plugin add`) is
not enough — the package also needs to be in that profile's
`dsh.profile.bundles` list (see [Install](#install)) before its `dsh.bundle`
patch gets applied.

**Loader crashes with `Cannot read properties of undefined (reading 'validate')`
on a fork.** A Cordis plugin's exported `Config` must be a schemastery
schema (`z.object({...})`), not a plain object — the loader calls
`.validate` on whatever `Config` exports.

## Development

```bash
npm install
npm run typecheck
npm test
```

Verified against a real local `dsh` boot (not just types): installed into a
scratch profile, patched in, and run against a live model — the outbound
request on turn 1 carried exactly the whitelisted tools and the preamble
text, and turn 2 carried the full toolset with no preamble.

## License

MIT
