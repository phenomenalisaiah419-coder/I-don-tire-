from backend.app.services.unified_project_renderer import render

def test_requires_video(tmp_path):
    try: render({},str(tmp_path/"o.mp4"))
    except ValueError: return
    assert False

def test_transition_project_selects_transition_path(monkeypatch,tmp_path):
    monkeypatch.setattr('backend.app.services.unified_project_renderer.validate_render_inputs', lambda p:p)
    monkeypatch.setattr('backend.app.services.render_security.settings.media_root', str(tmp_path))
    calls=[]
    monkeypatch.setattr("backend.app.services.unified_project_renderer.transition_render",
                        lambda v,o: calls.append("transition") or o)
    (tmp_path/"a.mp4").write_bytes(b"test")
    (tmp_path/"b.mp4").write_bytes(b"test")
    project={"videos":[
        {"input":str(tmp_path/"a.mp4"),"start":0,"end":2},
        {"input":str(tmp_path/"b.mp4"),"start":1,"end":3,"transition":"dissolve","overlap":1}
    ]}
    assert render(project,str(tmp_path/"out.mp4"))==str(tmp_path/"out.mp4")
    assert calls==["transition"]

def test_layers_use_integrated_path(monkeypatch,tmp_path):
    monkeypatch.setattr('backend.app.services.unified_project_renderer.validate_render_inputs', lambda p:p)
    monkeypatch.setattr('backend.app.services.render_security.settings.media_root', str(tmp_path))
    calls=[]
    monkeypatch.setattr("backend.app.services.unified_project_renderer.integrated_render",
                        lambda p,o: calls.append("integrated") or o)
    monkeypatch.setattr("backend.app.services.unified_project_renderer.transition_render",
                        lambda v,o: calls.append("transition") or o)
    (tmp_path/"a.mp4").write_bytes(b"test")
    (tmp_path/"b.mp4").write_bytes(b"test")
    (tmp_path/"a.mp3").write_bytes(b"test")
    project={"videos":[
        {"input":str(tmp_path/"a.mp4"),"start":0,"end":2},
        {"input":str(tmp_path/"b.mp4"),"start":1,"end":3,"transition":"dissolve","overlap":1}
    ],"audios":[{"input":str(tmp_path/"a.mp3"),"start":0}]}
    assert render(project,str(tmp_path/"out.mp4"))==str(tmp_path/"out.mp4")
    assert calls==["integrated"]
