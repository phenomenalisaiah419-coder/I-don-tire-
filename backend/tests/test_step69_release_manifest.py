def test_manifest_hashes_files(tmp_path):
    from backend.app.services.release_manifest import build_manifest
    f=tmp_path/"a.txt"; f.write_text("phenova")
    m=build_manifest(tmp_path)
    assert m["file_count"]==1
    assert len(m["files"][0]["sha256"])==64
