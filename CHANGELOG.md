# Changelog

## 0.1.0

Initial release.

- Prunes the tool schema to a configurable whitelist (`read`, `glob`, `grep`
  by default) on a session's first `system-prompt/assemble` turn only.
- Injects a configurable structural preamble on that same turn.
- Every later turn for the same scope passes through untouched.
- Verified against a live `dsh` boot: the outbound model request on turn 1
  carries exactly the whitelisted tools + preamble; turn 2 carries the full
  toolset with no preamble.
