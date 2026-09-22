# ghidra-decompiler

Decompiles a binary using Ghidra's headless analyzer and returns C-like
pseudocode -- for reverse engineering and CTF-style analysis.

This is a **custom-Dockerfile** tool: it does not use the default
`node:20-alpine` sandbox. Its image bundles a JDK and downloads the latest
public Ghidra release during the Docker build step (which has network
access), so the tool itself can still run fully network-isolated at
execution time.

## Usage

Select the folder containing the target binary as your chat's workspace,
then ask the agent to decompile a file by its relative path, e.g.:

> "Use the decompiler tool on `challenge.bin`"

## Known limitations -- please read before testing

This was built without being able to run a Docker daemon directly, so treat
it as a strong first draft, not a guaranteed-working tool. Likely things to
tune:

1. **Image size.** Ghidra's release zip is ~500MB+ on its own, plus a JDK 21
   base image -- the combined image will likely exceed a 1GB build-time size
   cap if one is enforced. You may need to raise that limit specifically for
   this tool (it's already gated behind manual verification, which reduces
   the risk this was meant to guard against).
2. **Memory.** Ghidra can be memory-hungry on anything beyond small
   binaries. The current sandbox's hard memory cap may not be enough for
   real-world executables -- expect this to work reliably on small
   CTF/crackme-style binaries first, and treat larger ones as a stretch goal.
3. **Timeout.** Decompilation of a nontrivial binary can take a while. The
   script caps itself at 200 functions and a 50-second subprocess timeout to
   stay under the platform's tool-call timeout, but a slow/large binary may
   still hit that ceiling -- if so, the tool reports a clear timeout message
   rather than hanging silently.
4. **Ghidra version.** The Dockerfile fetches whatever is currently the
   latest public Ghidra release from GitHub at build time, rather than a
   pinned version -- this keeps it current automatically, but means a future
   Ghidra release could change behavior. Pin a specific version in the
   Dockerfile if you want reproducible builds instead.

## Testing

```
agenthub-tool validate
agenthub-tool test
```

If `test` fails, check the Docker build output first (`docker build` logs
during `test`/`package`) before assuming the Python/Java logic is wrong --
given the size and version concerns above, the build step itself is the
most likely first failure point.
