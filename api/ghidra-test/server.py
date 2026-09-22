#!/usr/bin/env python3
"""
MCP stdio bridge for the Ghidra decompiler tool.

Implements the same JSON-RPC handshake (initialize / tools/list / tools/call)
that every AgentHub tool implements, but in Python rather than via the
Node.js SDK, since this tool's runtime is Ghidra + a JDK, not Node.
"""
import sys
import json
import subprocess
import tempfile
import os

GHIDRA_HOME = os.environ.get("GHIDRA_HOME", "/opt/ghidra")
ANALYZE_HEADLESS = os.path.join(GHIDRA_HOME, "support", "analyzeHeadless")
SCRIPTS_DIR = "/app/scripts"
WORKSPACE_DIR = "/workspace"

# Stay comfortably under the platform's ~60s tool-call timeout.
SUBPROCESS_TIMEOUT_SECONDS = 50
MAX_OUTPUT_CHARS = 15000


def send(msg_id, result=None, error=None):
    resp = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        resp["error"] = error
    else:
        resp["result"] = result
    sys.stdout.write(json.dumps(resp) + "\n")
    sys.stdout.flush()


def handle_initialize(msg_id):
    send(msg_id, {
        "protocolVersion": "2024-11-05",
        "serverInfo": {"name": "ghidra-decompiler", "version": "1.0.0"},
        "capabilities": {"tools": {}}
    })


def handle_tools_list(msg_id):
    send(msg_id, {
        "tools": [{
            "name": "decompile_binary",
            "description": (
                "Runs Ghidra's headless analyzer on a binary file and returns "
                "C-like decompiled pseudocode for its functions. The binary "
                "must already exist inside the current chat's workspace folder."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the binary, relative to the workspace root."
                    }
                },
                "required": ["path"]
            }
        }]
    })


def safe_resolve(rel_path):
    """Resolve a path relative to /workspace, refusing anything that
    escapes it (e.g. ../../etc/passwd)."""
    base = os.path.abspath(WORKSPACE_DIR)
    full = os.path.normpath(os.path.join(base, rel_path))
    if full != base and not full.startswith(base + os.sep):
        return None
    return full


def handle_tools_call(msg_id, params):
    name = params.get("name")
    args = params.get("arguments", {}) or {}

    if name != "decompile_binary":
        send(msg_id, error={"code": -32602, "message": f"Unknown tool: {name}"})
        return

    rel_path = args.get("path", "")
    binary_path = safe_resolve(rel_path)

    if not binary_path or not os.path.isfile(binary_path):
        send(msg_id, result={
            "content": [{"type": "text", "text": f"File not found in workspace: {rel_path}"}],
            "isError": True
        })
        return

    with tempfile.TemporaryDirectory(dir="/tmp") as tmp_dir:
        project_dir = os.path.join(tmp_dir, "proj")
        os.makedirs(project_dir, exist_ok=True)
        out_file = os.path.join(tmp_dir, "decompiled.txt")

        cmd = [
            ANALYZE_HEADLESS,
            project_dir, "GhidraProject",
            "-import", binary_path,
            "-scriptPath", SCRIPTS_DIR,
            "-postScript", "DecompileAll.java", out_file,
            "-deleteProject",
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=SUBPROCESS_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            send(msg_id, result={
                "content": [{"type": "text", "text": "Decompilation timed out. Try a smaller binary."}],
                "isError": True
            })
            return

        if os.path.isfile(out_file):
            with open(out_file, "r", errors="replace") as f:
                pseudocode = f.read()
            if not pseudocode.strip():
                pseudocode = "(No functions were decompiled. The file may not be a supported executable format.)"
        else:
            # Surface Ghidra's own log on failure -- essential for debugging
            # since this environment can't be tested ahead of time.
            pseudocode = (
                "Ghidra did not produce output. Analyzer log (tail):\n"
                + result.stdout[-3000:] + "\n" + result.stderr[-1500:]
            )

        send(msg_id, result={
            "content": [{"type": "text", "text": pseudocode[:MAX_OUTPUT_CHARS]}]
        })


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = msg.get("method")
        msg_id = msg.get("id")

        if method == "initialize":
            handle_initialize(msg_id)
        elif method == "tools/list":
            handle_tools_list(msg_id)
        elif method == "tools/call":
            handle_tools_call(msg_id, msg.get("params", {}))


if __name__ == "__main__":
    main()
