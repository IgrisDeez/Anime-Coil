"""Refresh local review downloads/source archive; never read user-state backups."""
from pathlib import Path
import zipfile, json, hashlib, shutil
ROOT=Path(__file__).resolve().parents[1];PARENT=ROOT.parent
EXCLUDE={'storage-review-backup.json','local-archives.json','node_modules','.git','.sites-runtime','__pycache__'}
def files(path):
    for p in sorted(path.rglob('*')):
        if p.is_file() and not p.is_symlink() and not any(part in EXCLUDE for part in p.relative_to(ROOT).parts) and p.suffix not in {'.blend1','.blend2','.log'}:yield p
def archive(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for p,label in entries:z.write(p,label)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert not any('storage-review-backup.json' in n or 'node_modules/' in n or '/.git/' in n or n.endswith('.blend1') for n in z.namelist())
    return {'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
models=[]
for name in ['kairo','pomu','shiro']:
    folder=ROOT/'assets/roster/candidates'/name
    entries=[(p,str(p.relative_to(folder)).replace('\\','/')) for p in files(folder)]
    for suffix in ['four-views','comparison','coil-fit']:p=ROOT/'docs/roster-review'/f'{name}-{suffix}.png';entries.append((p,p.name))
    models.append(archive(PARENT/f'Anime-Coil-{name.title()}-Blender-review.zip',entries))
source=[]
for name in ['README.md','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','.gitignore']:
    p=ROOT/name
    if p.is_file():source.append((p,'anime-coil/'+name))
for name in ['src','public','tests','scripts','assets','docs']:
    source.extend((p,'anime-coil/'+str(p.relative_to(ROOT)).replace('\\','/')) for p in files(ROOT/name))
sourceInfo=archive(PARENT/'anime-coil-v1.7.5-source.zip',source)
receipt={'version':'1.7.5','source':sourceInfo,'models':models,'excludes':['Git metadata','dependencies','Blender backup files','local user-state review backup']}
(ROOT/'docs/ultimate-polish/local-archives.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,indent=2))
