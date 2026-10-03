"""Package the unpromoted local candidate and actual review evidence, without user state."""
from pathlib import Path
import zipfile,json,hashlib
ROOT=Path(__file__).resolve().parents[1];PARENT=ROOT.parent;REVIEW=ROOT/'docs/ultimate-catastrophe'
EXCLUDE={'storage-review-backup.json','local-archives.json','node_modules','.git','.sites-runtime','__pycache__','raw-video'}
def files(folder):
    for p in sorted(folder.rglob('*')):
        if p.is_file() and not p.is_symlink() and not any(part in EXCLUDE for part in p.relative_to(ROOT).parts) and p.suffix not in {'.blend1','.blend2','.log'} and p.name!='movie-offset-study.png':yield p
def archive(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for p,label in entries:z.write(p,label)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert not any('storage-review-backup.json' in n or 'node_modules/' in n or '/.git/' in n or '/raw-video/' in n or n.endswith(('.blend1','.blend2')) for n in z.namelist())
    return {'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

source=[]
for name in ['README.md','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','.gitignore']:
    p=ROOT/name
    if p.is_file():source.append((p,'anime-coil/'+name))
for name in ['src','public','tests','scripts','assets','docs']:
    source.extend((p,'anime-coil/'+str(p.relative_to(ROOT)).replace('\\','/')) for p in files(ROOT/name))
source_info=archive(PARENT/'anime-coil-v1.7.6-review-source.zip',source)
review=[(p,str(p.relative_to(REVIEW)).replace('\\','/')) for p in files(REVIEW)]
review.append((ROOT/'docs/ULTIMATE-VFX-1.7.6-REVIEW.md','ULTIMATE-VFX-1.7.6-REVIEW.md'))
review_info=archive(PARENT/'Anime-Coil-Ultimate-VFX-1.7.6-review.zip',review)
models=[]
for name in ['kairo','pomu','shiro']:
    folder=ROOT/'assets/roster/candidates'/name
    entries=[(p,str(p.relative_to(folder)).replace('\\','/')) for p in files(folder)]
    for suffix in ['four-views','comparison','coil-fit']:
        p=ROOT/'docs/roster-review'/f'{name}-{suffix}.png';entries.append((p,p.name))
    models.append(archive(PARENT/f'Anime-Coil-{name.title()}-Blender-review.zip',entries))
receipt={'candidateVersion':'1.7.6','packageVersion':json.loads((ROOT/'package.json').read_text())['version'],'releaseState':'Visual review; version promotion/publication pending agreed approval','source':source_info,'review':review_info,'models':models,'excludes':['Git metadata','dependencies','duplicate raw video','Blender backup files','local user-state backup']}
(REVIEW/'local-archives.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
