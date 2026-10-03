"""Copy verified release source into the opened managed Site; preserve its metadata/thumbnail."""
from pathlib import Path
import shutil, json, hashlib, subprocess
SOURCE=Path(__file__).resolve().parents[1]
SITE=Path('C:/Users/denze/Documents/ChatGPT/Anime Coil/gpt-sites/anime-coil').resolve()
assert SITE.parent==Path('C:/Users/denze/Documents/ChatGPT/Anime Coil/gpt-sites').resolve()
assert json.loads((SITE/'.openai/hosting.json').read_text())['project_id']=='appgprj_6abe789685a88191a4528067c91c4ac4'
status=subprocess.run(['git','status','--porcelain'],cwd=SITE,check=True,text=True,capture_output=True).stdout
assert not status.strip(),'Preserve unexpected Site checkout edits before copying.'
before={str(p.relative_to(SITE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SITE/'.openai/hosting.json',SITE/'public/screenshot.jpeg'] if p.exists()}
skip={'storage-review-backup.json','local-archives.json','node_modules','.git','.sites-runtime','__pycache__','raw-video'}
copied=[]
def copy(p):
    rel=p.relative_to(SOURCE)
    if p.is_symlink() or any(part in skip for part in rel.parts) or p.suffix in {'.blend1','.blend2','.log'}:return
    if str(rel).replace('\\','/')=='public/screenshot.jpeg':return
    target=SITE/rel;assert target.resolve().is_relative_to(SITE);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target);copied.append(str(rel))
for name in ['README.md','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','.gitignore']:
    copy(SOURCE/name)
for name in ['src','public','tests','scripts','assets','docs']:
    for p in (SOURCE/name).rglob('*'):
        if p.is_file():copy(p)
for rel,digest in before.items():assert hashlib.sha256((SITE/rel).read_bytes()).hexdigest()==digest
for name in ['src','public','tests']:
    for p in (SOURCE/name).rglob('*'):
        if p.is_file() and not any(part in skip for part in p.relative_to(SOURCE).parts) and p.name!='screenshot.jpeg':assert p.read_bytes()==(SITE/p.relative_to(SOURCE)).read_bytes()
print(json.dumps({'site':str(SITE),'version':json.loads((SITE/'package.json').read_text())['version'],'copiedFiles':len(copied),'metadataAndThumbnailPreserved':True,'productionAndTestInputsMatched':True}))
