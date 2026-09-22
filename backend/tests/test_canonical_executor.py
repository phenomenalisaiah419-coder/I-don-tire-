from backend.app.services.canonical_executor import execute_operation

def test_transform_dispatch(monkeypatch):
    called={}
    def fake(*args,**kwargs):
        called["ok"]=True
        return "/tmp/out.mp4"
    monkeypatch.setattr("backend.app.services.canonical_executor.render_transform",fake)
    r=execute_operation({"operation":"transform","input_path":"a","output_path":"b"})
    assert r["status"]=="COMPLETED" and called["ok"]

def test_unknown_operation_rejected():
    try: execute_operation({"operation":"run_shell"})
    except ValueError: return
    assert False
