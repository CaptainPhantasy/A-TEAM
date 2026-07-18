#!/usr/bin/env python3
"""Open Anvil Native Messaging Host.

Chrome launches this process via nativeMessaging. It bridges Chrome's
4-byte little-endian framed pipe to the MCP server's JSON-RPC stdio.

Lifecycle: Chrome manages this process. It exits when Chrome closes stdin.

Protocol translation:
  Chrome → Server:  tool_response / perception_* → MCP JSON-RPC on server stdin
  Server → Chrome:  MCP JSON-RPC responses → native messaging framed output
"""

import json
import os
import signal
import shutil
import struct
import subprocess
import sys
import threading

# ── Configuration ────────────────────────────────────────────────────────────

NATIVE_HOST_NAME = "com.openanvil.native"
MAX_MESSAGE_SIZE = 1 * 1024 * 1024  # 1 MB — Chrome's native messaging limit
SERVER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcp-server", "server.js")
NODE_BIN = os.environ.get("ANVIL_NODE_BIN") or shutil.which("node") or "/usr/bin/node"


# ── Chrome Native Messaging I/O ──────────────────────────────────────────────

def read_native_message():
    """Read a single length-prefixed message from Chrome on stdin.

    Returns the parsed JSON dict, or None on EOF/clean shutdown.
    Raises ValueError on oversized messages.
    """
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length or len(raw_length) < 4:
        return None  # Chrome closed stdin — clean shutdown

    length = struct.unpack("<I", raw_length)[0]
    if length == 0:
        return None

    if length > MAX_MESSAGE_SIZE:
        raise ValueError(f"Message too large: {length} bytes (max {MAX_MESSAGE_SIZE})")

    raw_message = sys.stdin.buffer.read(length)
    if not raw_message or len(raw_message) < length:
        return None  # Incomplete read — Chrome disconnecting

    return json.loads(raw_message.decode("utf-8"))


def write_native_message(msg):
    """Write a single length-prefixed JSON message to Chrome on stdout."""
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


# ── Protocol Translation (pure functions, testable) ──────────────────────────

def translate_chrome_to_mcp(msg):
    """Translate a Chrome native message to MCP JSON-RPC.

    Returns the MCP message dict, or None if the message is handled
    locally (e.g., anvil_register).
    """
    msg_type = msg.get("type", "")

    if msg_type == "tool_response":
        return {
            "jsonrpc": "2.0",
            "method": "anvil/tool_response",
            "params": {
                "id": msg.get("requestId", ""),
                "success": msg.get("success", True),
                "result": msg.get("result"),
                "error": msg.get("error"),
            },
        }

    if msg_type.startswith("mcp_perception_") or msg_type.startswith("perception_"):
        return {
            "jsonrpc": "2.0",
            "method": "anvil/perception",
            "params": msg,
        }

    if msg_type == "mcp_browser_event":
        return {
            "jsonrpc": "2.0",
            "method": "anvil/browser_event",
            "params": msg,
        }

    if msg_type == "anvil_register":
        # Handled locally — caller should send ready acknowledgment
        return None

    # Forward unknown types as anvil/<type> notifications
    return {
        "jsonrpc": "2.0",
        "method": f"anvil/{msg_type}",
        "params": msg,
    }


def translate_mcp_to_chrome(msg):
    """Translate an MCP JSON-RPC message to Chrome native format.

    Returns the Chrome message dict, or None if the message should
    be ignored (not JSON-RPC, no method).
    """
    if msg.get("jsonrpc") != "2.0":
        return None

    method = msg.get("method", "")

    if method == "anvil/tool_call":
        params = msg.get("params", {})
        return {
            "type": "mcp_tool_call",
            "requestId": params.get("id", ""),
            "tool": params.get("tool", ""),
            "args": params.get("args", {}),
        }

    if "result" in msg or "error" in msg:
        # MCP response to the MCP client (pi/Claude) — not for the extension
        return None

    if method:
        # Other notifications — extract type from method name
        params = msg.get("params", {})
        params.setdefault("type", method.replace("anvil/", ""))
        return params

    return None


# ── MCP Server Subprocess ────────────────────────────────────────────────────

def spawn_server():
    """Spawn server.js with MCP_TRANSPORT=stdio.

    Returns the subprocess.Popen object.
    """
    env = os.environ.copy()
    env["MCP_TRANSPORT"] = "stdio"
    env["ANVIL_WS_ENABLED"] = "false"

    return subprocess.Popen(
        [NODE_BIN, SERVER_SCRIPT],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=env,
    )


# ── Thread: Server stdout → Chrome ───────────────────────────────────────────

def server_to_chrome(proc, shutdown_event):
    """Read MCP JSON-RPC from server stdout, translate, write to Chrome."""
    try:
        for line in proc.stdout:
            if shutdown_event.is_set():
                break
            line = line.decode("utf-8", errors="replace").strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            chrome_msg = translate_mcp_to_chrome(msg)
            if chrome_msg is not None:
                write_native_message(chrome_msg)
    except (BrokenPipeError, OSError):
        pass  # Chrome disconnected
    finally:
        shutdown_event.set()


# ── Thread: Chrome stdin → Server ────────────────────────────────────────────

def chrome_to_server(proc, shutdown_event):
    """Read native messages from Chrome, translate, write to server stdin."""
    try:
        while not shutdown_event.is_set():
            try:
                msg = read_native_message()
            except ValueError as e:
                sys.stderr.write(f"[native_host] Dropping message: {e}\n")
                continue
            except json.JSONDecodeError as e:
                sys.stderr.write(f"[native_host] Malformed JSON: {e}\n")
                continue

            if msg is None:
                break  # Chrome closed stdin

            mcp_msg = translate_chrome_to_mcp(msg)

            if mcp_msg is None:
                # anvil_register — acknowledge locally
                write_native_message({"type": "ready", "version": "1.2.0"})
                continue

            line = json.dumps(mcp_msg) + "\n"
            try:
                proc.stdin.write(line.encode("utf-8"))
                proc.stdin.flush()
            except (BrokenPipeError, OSError):
                break  # Server died
    except Exception:
        pass
    finally:
        shutdown_event.set()


# ── Main Loop ────────────────────────────────────────────────────────────────

def main():
    shutdown_event = threading.Event()

    def handle_signal(signum, frame):
        shutdown_event.set()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        proc = spawn_server()
    except Exception as e:
        sys.stderr.write(f"[native_host] Failed to spawn server: {e}\n")
        sys.exit(1)

    t_server = threading.Thread(target=server_to_chrome, args=(proc, shutdown_event), daemon=True)
    t_chrome = threading.Thread(target=chrome_to_server, args=(proc, shutdown_event), daemon=True)
    t_server.start()
    t_chrome.start()

    shutdown_event.wait()

    try:
        proc.stdin.close()
    except Exception:
        pass
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


if __name__ == "__main__":
    main()
