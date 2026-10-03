"""Fresh review archives; preserve earlier release artifacts and private state."""
from pathlib import Path
import zipfile, json, hashlib

ROOT=Path(__file__).resolve().parents[1];PARENT=ROOT.parent
REVIEW=ROOT/'docs/hair-review';ASSETS=ROOT/'assets/roster/hair-review'
EXCLUDE={'storage-review-backup.json','local-archives.json','node_modules','.git','.sites-runtime','__pycache__','raw-video','setup-owned-pid.txt'}

def files(folder):
    for p in sorted(folder.rglob('*')):
        if not p.is_file() or p.is_symlink():continue
        parts=p.relative_to(ROOT).parts
        if any(part in EXCLUDE for part in parts) or p.suffix in {'.blend1','.blend2','.log'}:continue
        if p.name.startswith('draft-') or p.name=='movie-offset-study.png':continue
        yield p

def archive(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for p,label in entries:z.write(p,label)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert not any('storage-review-backup.json' in n or 'node_modules/' in n or '/.git/' in n or n.endswith(('.blend1','.blend2')) for n in z.namelist())
    return {'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

models=[]
for name in ['kitsu','kairo','pomu','shiro']:
    folder=ASSETS/name;entries=[(p,str(p.relative_to(folder)).replace('\\','/')) for p in files(folder)]
    entries.append((REVIEW/(name+'-four-views.png'),name+'-four-views.png'))
    entries.append((ROOT/'docs/HAIR-DETAIL-REVIEW.md','HAIR-DETAIL-REVIEW.md'))
    models.append(archive(PARENT/f'Anime-Coil-{name.title()}-textured-hair-review.zip',entries))
review=[(p,str(p.relative_to(ROOT)).replace('\\','/')) for folder in [ASSETS,REVIEW] for p in files(folder)]
review.append((ROOT/'docs/HAIR-DETAIL-REVIEW.md','HAIR-DETAIL-REVIEW.md'))
review_info=archive(PARENT/'Anime-Coil-textured-hair-review.zip',review)
source=[]
for name in ['README.md','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','.gitignore']:
    p=ROOT/name
    if p.is_file():source.append((p,'anime-coil/'+name))
for name in ['src','public','tests','scripts','assets','docs']:
    source.extend((p,'anime-coil/'+str(p.relative_to(ROOT)).replace('\\','/')) for p in files(ROOT/name))
source_info=archive(PARENT/'anime-coil-v1.7.6-hair-review-source.zip',source)
receipt={'packageVersion':json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version'],'candidateRelease':'1.7.6 - awaiting visual approval','source':source_info,'review':review_info,'models':models,'publication':'Existing Site unchanged; no source push, deployment or GitHub action','excludes':['Dependencies','Git metadata','Blender backups','task process ID/logs','duplicate raw video','private user-state backup']}
(REVIEW/'local-archives.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,indent=2))
