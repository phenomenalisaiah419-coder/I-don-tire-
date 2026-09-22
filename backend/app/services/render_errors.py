"""Stable render error taxonomy."""
CODES={"VALIDATION":"RENDER_VALIDATION_FAILED","SECURITY":"RENDER_SECURITY_REJECTED","INPUT":"RENDER_INPUT_INVALID","EXECUTION":"RENDER_EXECUTION_FAILED","VERIFICATION":"RENDER_OUTPUT_INVALID","CANCELLED":"RENDER_CANCELLED","UNKNOWN":"RENDER_FAILED"}
def classify(exc):
    text=str(exc).lower()
    if "outside the phenova media" in text or "budget" in text or "layer" in text: return CODES["SECURITY"]
    if any(x in text for x in ("unsupported edit plan","operation not enabled","invalid timeline","requires input_path","unsupported render","schema")): return CODES["VALIDATION"]
    if any(x in text for x in ("input not found","input missing","unreadable media","no readable streams","no valid duration","ffprobe is not available")): return CODES["INPUT"]
    if any(x in text for x in ("ffprobe failed","output is missing","output has no valid","no video stream","invalid ffprobe","duration differs")): return CODES["VERIFICATION"]
    if "cancel" in text: return CODES["CANCELLED"]
    return CODES["EXECUTION"]
def public_error(exc): return classify(exc)
