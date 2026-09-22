#!/usr/bin/env python3
"""
PHENOVA matting worker — rembg-compatible HTTP service.

Run:
  pip install flask rembg pillow
  python workers/matting_server.py
  # listens on :7001

  export PHENOVA_MATTING_URL=http://127.0.0.1:7001/matte

Endpoints:
  GET  /health
  POST /matte   multipart file=...  optional model=u2net
"""

from __future__ import annotations

import io
import os
import sys

try:
    from flask import Flask, request, send_file, jsonify
except ImportError:
    print("Install flask: pip install flask", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)
PORT = int(os.environ.get("PHENOVA_MATTING_PORT", "7001"))

_session = None


def get_session(model: str = "u2net"):
    global _session
    try:
        from rembg import new_session
    except ImportError:
        return None
    if _session is None:
        _session = new_session(model)
    return _session


@app.get("/health")
def health():
    has_rembg = False
    try:
        import rembg  # noqa: F401
        has_rembg = True
    except ImportError:
        pass
    return jsonify({"ok": True, "rembg": has_rembg, "service": "phenova-matting"})


@app.post("/matte")
def matte():
    if "file" not in request.files and not request.data:
        return jsonify({"error": "file required"}), 400

    model = request.form.get("model") or request.args.get("model") or "u2net"
    session = get_session(model)

    if "file" in request.files:
        raw = request.files["file"].read()
    else:
        raw = request.data

    if session is not None:
        from rembg import remove
        out = remove(raw, session=session)
        return send_file(io.BytesIO(out), mimetype="image/png")

    # Fallback without rembg: return input unchanged with warning header
    # (client should treat as failure if it expected alpha)
    resp = send_file(io.BytesIO(raw), mimetype="application/octet-stream")
    resp.headers["X-Phenova-Matting"] = "passthrough-no-rembg"
    return resp


if __name__ == "__main__":
    print(f"PHENOVA matting worker on http://127.0.0.1:{PORT}")
    print("Set PHENOVA_MATTING_URL=http://127.0.0.1:%d/matte" % PORT)
    app.run(host="0.0.0.0", port=PORT, threaded=True)
