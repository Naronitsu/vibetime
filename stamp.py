"""Cache-busting: add ?v=<content hash> to every local script/stylesheet link in the HTML pages.

GitHub Pages lets browsers cache files for 10 minutes, which could mix an old app.js with a new page.
Because the link changes whenever a file's content changes, a page always loads matching files.
Runs automatically before each commit (see .git/hooks/pre-commit); you can also run it by hand:  python stamp.py
"""
import hashlib, pathlib, re

root = pathlib.Path(__file__).parent
assets = ['app.js', 'holidays.js', 'sky.js', 'style.css']
ver = {a: hashlib.md5((root / a).read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:8] for a in assets}

changed = []
for page in sorted(root.glob('*.html')):
    text = original = page.read_text(encoding='utf-8')
    for a in assets:
        text = re.sub(rf'((?:src|href)="){re.escape(a)}(?:\?v=[0-9a-f]+)?"', rf'\1{a}?v={ver[a]}"', text)
    if text != original:
        page.write_text(text, encoding='utf-8')
        changed.append(page.name)
print('stamped:', ', '.join(changed) or 'nothing to change')
