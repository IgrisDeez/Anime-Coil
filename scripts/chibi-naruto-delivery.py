"""Compose actual, unretouched Blender renders and refresh local review archives."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, zipfile, hashlib
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'assets/kitsu/candidates/chibi-naruto'
BG='#f7f8fa';INK='#253148'
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',28)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',21)
tiny=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
def place(canvas,im,rect,crop=False):
    im=im.convert('RGBA')
    if crop and im.getchannel('A').getextrema()[0]==0:im=im.crop(im.getchannel('A').getbbox())
    scale=min(rect[2]/im.width,rect[3]/im.height)
    im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    x,y,w,h=rect;canvas.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2),im)
def text(sheet,xy,label,large=False):ImageDraw.Draw(sheet).text(xy,label,font=font if large else small,fill=INK)
def save(sheet,name):sheet.save(OUT/name,quality=95)
views=[('Front','front'),('Three-quarter','three-quarter'),('Side','side'),('Back','back')]
sheet=Image.new('RGB',(1200,1280),BG)
text(sheet,(24,16),'KITSU / BALANCED CHIBI NARUTO',True)
for i,(label,file) in enumerate(views):
    x=(i%2)*600;y=65+(i//2)*575
    text(sheet,(x+24,y),label);place(sheet,Image.open(OUT/(file+'.png')),(x+8,y+25,584,550))
text(sheet,(24,1245),'Actual Blender renders. Separate candidate for visual review before game integration.')
save(sheet,'four-view-renders.jpg')
# Same-camera before/after comparison and latest identity reference.
sheet=Image.new('RGB',(1800,830),BG)
text(sheet,(24,16),'NARUTO IDENTITY / MATURE CANDIDATE / BALANCED CHIBI',True)
for i,(label,file,crop) in enumerate([('Latest supplied Naruto image','reference-naruto',False),('Previous mature candidate','mature-matched-front',False),('New chibi candidate','front',False)]):
    text(sheet,(i*600+24,74),label);place(sheet,Image.open(OUT/(file+'.png')),(i*600+12,112,576,640),crop)
text(sheet,(24,775),'Before/after use the same studio lights, camera and scale. Exposed face shortened by 20%.')
text(sheet,(24,805),'Soft cheeks, compact blue eyes, smaller ears, rounded nose and 15 shaped hair locks. Head only.')
save(sheet,'reference-comparison.jpg')
# Original reference supplies softness and depth; identity is intentionally
# updated to blue eyes, three whiskers, the Leaf plate and determination.
ref=Image.open(OUT/'reference-four-view.png');w,h=ref.size
sheet=Image.new('RGB',(2000,1320),BG)
text(sheet,(24,16),'ORIGINAL FOUR-VIEW REFERENCE / NEW CHIBI SCULPT',True)
text(sheet,(24,63),'Reference softness and depth, with the approved Naruto identity and expression.')
for i,(label,file) in enumerate(views):
    text(sheet,(i*500+24,110),label)
    rx=(i%2)*w//2;ry=(i//2)*h//2
    place(sheet,ref.crop((rx,ry,rx+w//2,ry+h//2)),(i*500+8,145,484,510))
    place(sheet,Image.open(OUT/(file+'.png')),(i*500+8,665,484,580))
text(sheet,(24,1275),'Top: supplied reference. Bottom: actual Blender renders. Side and rear anatomy are inferred.')
save(sheet,'four-view-reference-comparison.jpg')
sheet=Image.new('RGB',(1400,820),BG)
text(sheet,(24,16),'ATTACHMENT STUDY / EXISTING COIL',True)
for i,(label,file) in enumerate([('Front','coil-fit-front'),('Three-quarter','coil-fit-three-quarter')]):
    text(sheet,(i*700+24,66),label);place(sheet,Image.open(OUT/(file+'.png')),(i*700+8,90,684,675))
text(sheet,(24,775),'Existing origin, 0.12 Y mount and coil dimensions. Matching scale; no body redesign.')
text(sheet,(24,803),'Studio attachment study. Game camera, portraits and gameplay review follow visual approval.')
save(sheet,'coil-fit-preview.jpg')
sheet=Image.new('RGB',(1600,700),BG)
text(sheet,(24,16),'OPTIMIZED EXPORTS / MATCHED CAMERA',True)
for i,(label,file) in enumerate([('Desktop front','desktop-front'),('Mobile front','mobile-front'),('Desktop side','desktop-side'),('Mobile side','mobile-side')]):
    text(sheet,(i*400+24,68),label);place(sheet,Image.open(OUT/(file+'.png')),(i*400+8,100,384,540))
stats=json.loads((OUT/'candidate-validation.json').read_text())['profiles']
text(sheet,(24,665),f"{stats[0]['trianglesWithCoil']:,} desktop / {stats[1]['trianglesWithCoil']:,} mobile triangles including coil. 12 draws plus existing outline.")
save(sheet,'optimized-comparison.jpg')
sheet=Image.new('RGB',(1800,860),BG)
text(sheet,(24,16),'ANIME COIL / MATCHING CHARACTER SCALE',True)
for i,label in enumerate(['Kitsu candidate','Existing Kairo','Existing Pomu','Existing Shiro']):text(sheet,(i*450+24,70),label)
place(sheet,Image.open(OUT/'roster-scale.png'),(0,104,1800,690))
text(sheet,(24,816),'Existing characters extracted from unchanged createHead() meshes. Studio study, not a gameplay screenshot.')
save(sheet,'roster-scale-comparison.jpg')
sheet=Image.new('RGB',(1500,1000),BG)
text(sheet,(24,16),'SHARED GEOMETRY / INDEPENDENT BLINK TRANSFORMS',True)
text(sheet,(24,74),'Clone A: open');text(sheet,(775,74),'Clone B: blink')
place(sheet,Image.open(OUT/'independent-blink.png'),(0,100,1500,850))
text(sheet,(24,970),'Four eye batches share one 1.28 Y pivot per clone. The pupil batch includes the closing upper-eye accent.')
save(sheet,'independent-blink-study.jpg')
helpers=['scripts/blender/sculpt_chibi_naruto.py','scripts/blender/export_chibi_naruto.py','scripts/blender/render_chibi_naruto.py','scripts/blender/scale_chibi_naruto.py','scripts/blender/study_chibi_naruto.py','scripts/validate-chibi-naruto.ts','scripts/chibi-scale-study.ts','scripts/chibi-naruto-delivery.py']
archive=OUT.parent/'kitsu-chibi-naruto-review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as package:
    for path in sorted(OUT.iterdir()):
        if path.is_file() and path.suffix!='.blend1' and path.name!='existing-heads-scale.json':package.write(path,'chibi-naruto/'+path.name)
    for relative in helpers:package.write(BASE/relative,relative)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for name in ['kitsu-chibi-naruto.blend','kitsu-head-desktop.glb','kitsu-head-mobile.glb']:
        assert package.read('chibi-naruto/'+name)==(OUT/name).read_bytes()
# Fresh full local source snapshot under a distinct review name. Do not replace
# any existing release archive or publish this candidate into the game.
source_archive=BASE.parent/'anime-coil-chibi-review-source.zip'
excluded={'node_modules','.git','dist','.vite','.codex','test-results','playwright-report'}
with zipfile.ZipFile(source_archive,'w',zipfile.ZIP_DEFLATED) as package:
    for path in sorted(BASE.rglob('*')):
        relative=path.relative_to(BASE)
        if not path.is_file() or excluded.intersection(relative.parts):continue
        if path.suffix=='.blend1' or path.suffix=='.zip' or path.name=='existing-heads-scale.json':continue
        package.write(path,'anime-coil/'+relative.as_posix())
with zipfile.ZipFile(source_archive) as package:assert package.testzip() is None
print(json.dumps({'reviewArchive':str(archive),'sourceArchive':str(source_archive),'reviewBytes':archive.stat().st_size,'sourceBytes':source_archive.stat().st_size},indent=2))
