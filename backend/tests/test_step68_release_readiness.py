def test_release_readiness_modules():
    from backend.app.services.release_readiness import check
    result=check()
    assert result["status"]=="READY"
    assert result["checks"]
    assert result["render_limits"]["max_concurrent"]>=1
