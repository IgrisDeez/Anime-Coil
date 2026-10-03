"""Compose actual render/capture sheets and package editable release assets without user-state backups."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import zipfile, hashlib, json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/living-shibuya-1.7.7';OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',24)
title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',36)
def sheet(name,heading,items,columns=2,w=700,h=490,note='Actual Blender renders / actual game captures'):
    rows=(len(items)+columns-1)//columns;canvas=Image.new('RGB',(columns*w,rows*(h+42)+120),'#171d2c');d=ImageDraw.Draw(canvas);d.text((24,14),heading,font=title,fill='#f4f0ff');d.text((24,65),note,font=font,fill='#b9c6dc')
    for i,(label,path) in enumerate(items):
        x=(i%columns)*w;y=120+(i//columns)*(h+42);image=Image.open(path).convert('RGB');image=ImageOps.contain(image,(w-16,h));canvas.paste(image,(x+(w-image.width)//2,y+(h-image.height)//2));d.text((x+16,y+h+5),label,font=font,fill='#eff2ff')
    canvas.save(OUT/name);return str(OUT/name)
head=ROOT/'assets/pomu-gear5/v177/renders';city=ROOT/'assets/shibuya/v177/renders'
sheet('gear5-four-views.png','Pomu Gear 5 — editable Blender sculpt',[(a.title(),head/(a+'-desktop.png')) for a in ['front','three-quarter','side','rear']],w=600,h=540,note='0.12 Y mount • independent 1.28 Y expression pivot • +Z forward')
sheet('fist-four-views.png','Bajrang-style Haki fist — coherent sculpt',[(a.title(),head/('fist-'+a+'.png')) for a in ['front','three-quarter','side','rear']],w=600,h=540,note='Rounded knuckles, folded fingers, thumb and wrist • charcoal diffuse shading')
sheet('city-four-views.png','Living Shibuya — assembled Blender kit',[(a.title(),city/('city-'+a+'.png')) for a in ['front','three-quarter','side','rear']],w=800,h=535,note='Six architectural families • original circular playfield retained')
sheet('coil-attachment.png','Pomu Gear 5 — retained coil attachment',[('Blender attachment study',head/'attachment-desktop.png'),('In-game eye-pop and elastic windup',OUT/'after/desktop-skybreaker-eye-pop.png')],w=800,h=600,note='Normal coil origin and body scale are preserved; ultimate gags affect presentation transforms')
sheet('matched-comparison.png','Anime Coil 1.7.6 → 1.7.7',[('1.7.6 • Shibuya lobby',OUT/'before/desktop-pomu-menu.png'),('1.7.7 • Living Shibuya lobby',OUT/'after/desktop-pomu-menu.png'),('1.7.6 • Pomu charge',OUT/'before/desktop-skybreaker-charge.png'),('1.7.7 • Gear 5 charge',OUT/'after/desktop-skybreaker-charge.png'),('1.7.6 • impact',OUT/'before/desktop-skybreaker-impact.png'),('1.7.7 • rubber street / comic impact',OUT/'after/desktop-skybreaker-impact.png')],w=800,h=500,note='Same seeded 21-snake fixture, viewport, character and held cinematic times')
sheet('gear5-timeline.png','Pomu — 5.6-second cinematic',[(label,OUT/('after/desktop-skybreaker-'+stage+'.png')) for label,stage in [('0–0.9s • summon / laugh','summon'),('1.45s • eye-pop','eye-pop'),('2.15s • giant Haki windup','charge'),('2.6s • anticipation hold','anticipation'),('3.05s • descent','launch'),('3.48s • impact','impact'),('3.82s • rubber rebound','rebound'),('4.6s • flattened recovery','recovery')]],w=640,h=400,note='Presentation timeline; authoritative elimination remains 3.4s')
sheet('phone-review.png','Phone-width review — 390 × 844',[('Pomu lobby',OUT/'after/phone-pomu-menu.png'),('Gear 5 charge',OUT/'after/phone-skybreaker-charge.png'),('Impact',OUT/'after/phone-skybreaker-impact.png'),('Large boundary cast / comfort settings',OUT/'after/phone-boundary-large-reduced.png')],columns=4,w=390,h=844,note='Real Edge WebGL at phone width; physical-phone testing remains unperformed')
SKIP={'storage-review-backup.json','local-archives.json','node_modules','.git','.sites-runtime','__pycache__','raw-video'}
def files(folder):
    for p in sorted(folder.rglob('*')):
        if p.is_file() and not p.is_symlink() and not any(part in SKIP for part in p.relative_to(ROOT).parts) and p.suffix not in {'.blend1','.blend2','.log'}:yield p
def archive(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for p,label in entries:z.write(p,label)
    with zipfile.ZipFile(target) as z:assert z.testzip() is None;assert not any('storage-review-backup' in n or 'node_modules/' in n for n in z.namelist())
    return {'path':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
assets=[(p,str(p.relative_to(ROOT/'assets')).replace('\\','/')) for folder in [ROOT/'assets/shibuya/v177',ROOT/'assets/pomu-gear5/v177'] for p in files(folder)]
assets.extend((p,p.name) for p in OUT.glob('*.png'))
asset_info=archive(ROOT.parent/'Anime-Coil-v1.7.7-editable-assets.zip',assets)
source=[]
for name in ['README.md','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','.gitignore']:
    p=ROOT/name
    if p.is_file():source.append((p,'anime-coil/'+name))
for name in ['src','public','tests','scripts','assets','docs']:source.extend((p,'anime-coil/'+str(p.relative_to(ROOT)).replace('\\','/')) for p in files(ROOT/name))
source_info=archive(ROOT.parent/'anime-coil-v1.7.7-source.zip',source)
receipt={'version':'1.7.7','editableAssets':asset_info,'source':source_info,'excludes':sorted(SKIP)}
(OUT/'local-archives.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8');print(json.dumps(receipt,indent=2))
