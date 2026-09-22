from backend.app.services.rendered_versions import fingerprint_file, attach_rendered_asset

def test_rendered_file_is_fingerprinted(tmp_path):
    p=tmp_path/"result.mp4"; p.write_bytes(b"real-rendered-media")
    fp=fingerprint_file(str(p))
    assert fp["size_bytes"]>0 and len(fp["sha256"])==64

def test_attach_requires_renderable_version(tmp_path):
    p=tmp_path/"result.mp4"; p.write_bytes(b"media")
    v={"version_id":"v1","status":"READY_FOR_CANONICAL_EXECUTOR"}
    r=attach_rendered_asset(v,str(p))
    assert r["status"]=="RENDERED"
    assert r["rendered_asset"]["sha256"]
