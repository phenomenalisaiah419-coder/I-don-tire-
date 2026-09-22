import ast, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
errors=[]
for p in (root/'backend').rglob('*.py'):
    try: ast.parse(p.read_text(errors='ignore'), filename=str(p))
    except SyntaxError as e: errors.append(f'{p.relative_to(root)}:{e.lineno}: {e.msg}')
if errors:
    print('SYNTAX CHECK FAILED'); print('\n'.join(errors)); raise SystemExit(1)
print('Python syntax: PASS')
r=subprocess.run([sys.executable,'-m','pytest','-q','--disable-warnings'],cwd=root,env={**__import__('os').environ,'PYTHONPATH':str(root)})
raise SystemExit(r.returncode)
