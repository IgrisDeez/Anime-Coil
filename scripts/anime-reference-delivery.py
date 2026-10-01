"""Compose unretouched Blender renders and package the staged candidate."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, zipfile
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'assets/kitsu/candidates/anime-reference'
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',28)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',21)
BG='#f7f8fa';INK='#253148'
def place(canvas,im,rect,crop=False):
    im=im.convert('RGBA')
    if crop and im.getchannel('A').getextrema()[0]==0:im=im.crop(im.getchannel('A').getbbox())
    scale=min(rect[2]/im.width,rect[3]/im.height)
    im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    x,y,w,h=rect;canvas.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2),im)
def text(sheet,xy,label,large=False):ImageDraw.Draw(sheet).text(xy,label,font=font if large else small,fill=INK)
sheet=Image.new('RGB',(1200,1280),BG)
text(sheet,(24,16),'KITSU / ANIME REFERENCE CANDIDATE',True)
for label,file,x,y in [('Front','front',0,60),('Three-quarter','three-quarter',600,60),('Side - inferred','side',0,650),('Back - inferred','back',600,650)]:
    text(sheet,(x+24,y),label);place(sheet,Image.open(OUT/(file+'.png')),(x+8,y+28,584,555))
text(sheet,(24,1250),'Actual Blender renders. Staged for visual approval; game assets are unchanged.')
sheet.save(OUT/'four-view-renders.jpg',quality=95)
sheet=Image.new('RGB',(1200,850),BG)
text(sheet,(24,16),'LATEST NARUTO REFERENCE / NEW SCULPT',True)
text(sheet,(30,74),'Supplied reference (crown cropped)');text(sheet,(625,74),'Actual Blender front render')
place(sheet,Image.open(OUT/'reference.png').crop((30,0,205,184)),(35,125,530,640))
place(sheet,Image.open(OUT/'front.png'),(625,125,540,640),True)
text(sheet,(24,790),'Head only: tapered jaw, smaller almond blue eyes, focused brows, layered blond hair.')
text(sheet,(24,819),'Side and back are inferred from the front image; this is not an exact 3D reconstruction.')
sheet.save(OUT/'reference-comparison.jpg',quality=95)
sheet=Image.new('RGB',(1400,800),BG)
text(sheet,(24,16),'ATTACHMENT STUDY / EXISTING COIL DIMENSIONS',True)
for i,(label,file) in enumerate([('Front','coil-fit-front'),('Three-quarter','coil-fit-three-quarter')]):
    text(sheet,(i*700+24,66),label);place(sheet,Image.open(OUT/(file+'.png')),(i*700+8,92,684,665))
text(sheet,(24,770),'Existing origin, 0.12 Y mount and coil dimensions. Studio fit study, not a game screenshot.')
sheet.save(OUT/'coil-fit-preview.jpg',quality=95)
sheet=Image.new('RGB',(1600,700),BG)
text(sheet,(24,16),'OPTIMIZED EXPORTS / MATCHED CAMERA',True)
for i,(label,file) in enumerate([('Desktop front','desktop-front'),('Mobile front','mobile-front'),('Desktop side','desktop-side'),('Mobile side','mobile-side')]):
    text(sheet,(i*400+24,68),label);place(sheet,Image.open(OUT/(file+'.png')),(i*400+8,100,384,540))
stats=json.loads((OUT/'candidate-validation.json').read_text())['profiles']
text(sheet,(24,665),f"{stats[0]['trianglesWithCoil']:,} desktop / {stats[1]['trianglesWithCoil']:,} mobile triangles including coil. 12 draws plus existing outline.")
sheet.save(OUT/'optimized-comparison.jpg',quality=95)
archive=OUT.parent/'kitsu-anime-reference-review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as package:
    for path in sorted(OUT.iterdir()):
        if path.is_file() and path.suffix!='.blend1':package.write(path,'anime-reference/'+path.name)
    for relative in ['scripts/blender/sculpt_anime_reference.py','scripts/blender/export_anime_reference.py','scripts/blender/render_anime_reference.py','scripts/validate-anime-reference.ts','scripts/anime-reference-delivery.py']:
        package.write(BASE/relative,relative)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for name in ['kitsu-anime-reference.blend','kitsu-head-desktop.glb','kitsu-head-mobile.glb']:
        assert package.read('anime-reference/'+name)==(OUT/name).read_bytes()
print('Four review sheets and verified archive:',archive)
