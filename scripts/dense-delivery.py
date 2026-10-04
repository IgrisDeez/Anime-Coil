"""Compose actual release views and package source without private state."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import zipfile, hashlib, json, sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/dense-shibuya-1.7.8'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',24)
title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',36)
def sheet(name,heading,items,columns=2,w=700,h=490,note='Actual Blender renders and actual game captures'):
    rows=(len(items)+columns-1)//columns;canvas=Image.new('RGB',(columns*w,rows*(h+42)+120),'#171d2c');d=ImageDraw.Draw(canvas)
    d.text((24,14),heading,font=title,fill='#f4f0ff');d.text((24,65),note,font=font,fill='#b9c6dc')
    for i,(label,p) in enumerate(items):
        x=i%columns*w;y=120+i//columns*(h+42);im=ImageOps.contain(Image.open(p).convert('RGB'),(w-16,h))
        canvas.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2));d.text((x+16,y+h+5),label,font=font,fill='#eff2ff')
    canvas.save(OUT/name)
city=ROOT/'assets/shibuya/v178/renders';fist=ROOT/'assets/pomu-gear5/v178/renders'
if '--archives-only' not in sys.argv:
    views=['front','three-quarter','side','rear']
    sheet('city-four-views.png','Dense Shibuya — assembled Blender city',[(v.title(),city/('city-'+v+'.png')) for v in views],w=800,h=535,note='48 foreground buildings, varied middle and rear streets; retained game clearance')
    sheet('kit-four-views.png','Shibuya — fourteen architecture families',[(v.title(),city/('kit-'+v+'.png')) for v in views],w=800,h=535,note='Balcony hotels, rooftop gardens, civic buildings and angled crowns join the landmark kit')
    sheet('fist-four-views.png','Pomu — closed Haki fist',[(v.title(),fist/('fist-'+v+'.png')) for v in views],w=600,h=540,note='Four knuckles, folded fingers, thumb, wrist; projected creases')
    sheet('road-study.png','Road alignment and city density',[('1.7.7 • previous crossings',OUT/'before/desktop-kitsu-menu.png'),('1.7.8 • connected landings and lanes',OUT/'after/desktop-kitsu-menu.png'),('Final Blender street plan',city/'city-plan.png'),('Final Blender city overview',city/'city-three-quarter.png')],w=800,h=590,note='Same seeded lobby captures; architecture follows the road approaches')
    sheet('coil-attachment.png','Pomu — wrist, arm and retained coil',[('Actual Blender attachment study',fist/'wrist-contact-study.png'),('In-game charge and shoulder attachment',OUT/'after/desktop-skybreaker-charge.png')],w=800,h=600,note='Approved Gear 5 head and original mount preserved; hand and arm share the strike tangent')
    sheet('matched-comparison.png','Anime Coil 1.7.7 → 1.7.8',[(v+' • '+label,OUT/folder/('desktop-'+name+'.png')) for label,name in [('Shibuya lobby','pomu-menu'),('Haki charge','skybreaker-charge'),('Red impact','skybreaker-impact'),('Retraction','skybreaker-recovery')] for v,folder in [('1.7.7','before'),('1.7.8','after')]],w=800,h=500,note='Matched fixture, viewport, character and held cinematic times')
    stages=[('Summon','summon'),('Eye-pop','eye-pop'),('Charge','charge'),('Anticipation','anticipation'),('Descent','launch'),('Impact','impact'),('Rubber rebound','rebound'),('Recovery','recovery')]
    sheet('haki-timeline.png','Pomu — aligned punch and red Haki aftermath',[(a,OUT/('after/desktop-skybreaker-'+v+'.png')) for a,v in stages],w=640,h=400,note='5.6-second presentation; authoritative elimination remains 3.4 seconds')
    sheet('phone-review.png','Phone-width review — 390 × 844',[(a,OUT/('after/phone-'+v+'.png')) for a,v in [('Shibuya lobby','pomu-menu'),('Charge','skybreaker-charge'),('Red impact','skybreaker-impact'),('Boundary / comfort settings','boundary-large-reduced')]],columns=4,w=390,h=844,note='Real Edge WebGL at phone width; physical-phone testing remains unperformed')
    sheet('reference-comparison.png','Requested road correction — reference and result',[('Supplied screenshot • disconnected road paint',OUT/'requested-road-reference.png'),('1.7.8 • landings, aligned lanes, varied architecture',OUT/'after/desktop-kitsu-menu.png')],w=800,h=550,note='Different screenshot sizes; actual game result without painted-over edits')
if '--sheets' in sys.argv:
    print(json.dumps({'sheets':9}));sys.exit()
SKIP={'storage-review-backup.json','local-archives.json','node_modules','.git','.sites-runtime','__pycache__','raw-video'}
def files(folder):
    for p in sorted(folder.rglob('*')):
        if p.is_file() and not p.is_symlink() and not any(x in SKIP for x in p.relative_to(ROOT).parts) and p.suffix not in {'.blend1','.blend2','.log'}:yield p
def archive(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for p,name in entries:z.write(p,name)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert not any('storage-review-backup' in n or 'node_modules/' in n for n in z.namelist())
    return {'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
assets=[(p,p.relative_to(ROOT/'assets').as_posix()) for f in [ROOT/'assets/shibuya/v178',ROOT/'assets/pomu-gear5/v178'] for p in files(f)]
assets.extend((p,p.name) for p in OUT.glob('*.png'))
assets.extend((ROOT/'scripts/blender'/n,'scripts/'+n) for n in ['dense_shibuya.py','dense_variety.py','dense_review.py','dense_overview.py','haki_fist.py'])
asset_info=archive(ROOT.parent/'Anime-Coil-v1.7.8-editable-assets.zip',assets)
source=[(ROOT/n,'anime-coil/'+n) for n in ['README.md','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','.gitignore']]
for n in ['src','public','tests','scripts','assets','docs']:source.extend((p,'anime-coil/'+p.relative_to(ROOT).as_posix()) for p in files(ROOT/n))
source_info=archive(ROOT.parent/'anime-coil-v1.7.8-source.zip',source)
receipt={'version':'1.7.8','editableAssets':asset_info,'source':source_info,'excludes':sorted(SKIP)}
(OUT/'local-archives.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
