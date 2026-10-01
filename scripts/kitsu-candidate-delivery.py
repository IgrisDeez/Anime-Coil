"""Layout actual Blender renders; no generated or retouched model imagery."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import zipfile
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'assets/kitsu/candidates/reference-rebuild'
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',28)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',21)
BG='#fffdf8';INK='#292b3e'
def place(canvas,image,rect,crop=False):
    image=image.convert('RGBA')
    if crop and image.getchannel('A').getextrema()[0]==0:image=image.crop(image.getchannel('A').getbbox())
    image.thumbnail(rect[2:],Image.Resampling.LANCZOS)
    x,y,w,h=rect;canvas.paste(image,(x+(w-image.width)//2,y+(h-image.height)//2),image)
def title(sheet,label):ImageDraw.Draw(sheet).text((24,16),label,font=font,fill=INK)
sheet=Image.new('RGB',(1200,1270),BG);title(sheet,'KITSU / REBUILT EDITABLE SCULPT - AWAITING REVIEW')
for label,file,x,y in [('Front','front',0,60),('Three-quarter','three-quarter',600,60),('True side (90 degrees)','side',0,650),('Back','back',600,650)]:
    ImageDraw.Draw(sheet).text((x+24,y),label,font=small,fill=INK)
    place(sheet,Image.open(OUT/(file+'.png')),(x+8,y+25,584,555))
sheet.save(OUT/'four-view-renders.jpg',quality=95)
ref=Image.open(BASE/'assets/kitsu/reference-four-view.png')
sheet=Image.new('RGB',(1800,1050),BG);title(sheet,'SUPPLIED REFERENCE / REBUILT KITSU')
crops=[(115,0,700,545),(754,0,1396,545),(110,550,710,1065),(780,550,1338,1065)]
for i,(label,file,crop) in enumerate(zip(['Front','Three-quarter','Reference side angle','Back'],['front','three-quarter','reference-side','back'],crops)):
    x=450*i;ImageDraw.Draw(sheet).text((x+24,62),label,font=small,fill=INK)
    place(sheet,ref.crop(crop),(x+8,94,434,405))
    place(sheet,Image.open(OUT/(file+'.png')),(x+18,565,414,420),crop=True)
ImageDraw.Draw(sheet).text((24,521),'Reference above / actual Blender candidate below. True 90-degree side also supplied separately.',font=small,fill=INK)
sheet.save(OUT/'reference-comparison.jpg',quality=95)
sheet=Image.new('RGB',(1600,560),BG);title(sheet,'PREVIOUS / REBUILD - MATCHED CAMERA AND STUDIO LIGHTING')
for i,(label,file) in enumerate([('Previous front','previous-front'),('Rebuilt front','front'),('Previous side','previous-side'),('Rebuilt side','side')]):
    x=i*400;ImageDraw.Draw(sheet).text((x+22,68),label,font=small,fill=INK)
    place(sheet,Image.open(OUT/(file+'.png')),(x+8,112,384,400))
sheet.save(OUT/'before-after.jpg',quality=95)
sheet=Image.new('RGB',(1400,800),BG);title(sheet,'ATTACHMENT STUDY / EXISTING COIL DIMENSIONS AND ORIGIN')
for i,(label,file) in enumerate([('Front','coil-fit-front'),('Three-quarter','coil-fit-three-quarter')]):
    x=i*700;ImageDraw.Draw(sheet).text((x+24,66),label,font=small,fill=INK)
    place(sheet,Image.open(OUT/(file+'.png')),(x+8,92,684,665))
sheet.save(OUT/'coil-fit-preview.jpg',quality=95)
sheet=Image.new('RGB',(1600,930),BG);title(sheet,'OPTIMIZED CANDIDATES / SAME SHAPE AND CAMERA')
for i,(label,file) in enumerate([('Desktop front','desktop-front'),('Mobile front','mobile-front'),('Desktop side','desktop-side'),('Mobile side','mobile-side')]):
    x=i*400;ImageDraw.Draw(sheet).text((x+24,66),label,font=small,fill=INK)
    place(sheet,Image.open(OUT/(file+'.png')),(x+8,92,384,760))
stats=json.loads((OUT/'candidate-validation.json').read_text())['profiles']
ImageDraw.Draw(sheet).text((24,881),f"{stats[0]['trianglesWithCoil']:,} desktop / {stats[1]['trianglesWithCoil']:,} mobile triangles including coil. 10 asset batches + coil + existing outline.",font=small,fill=INK)
sheet.save(OUT/'optimized-comparison.jpg',quality=95)
print('Five review sheets assembled from Blender renders.')
archive=OUT.parent/'kitsu-reference-review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as package:
    for path in sorted(OUT.iterdir()):
        if path.is_file() and path.suffix!='.blend1':package.write(path,'reference-rebuild/'+path.name)
    for relative in ['scripts/blender/rebuild_reference.py','scripts/blender/export_reference_candidate.py','scripts/blender/render_reference_candidate.py','scripts/validate-kitsu-candidate.ts','scripts/kitsu-candidate-delivery.py']:
        package.write(BASE/relative,relative)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for name in ['kitsu-head-reference-rebuild.blend','kitsu-head-desktop.glb','kitsu-head-mobile.glb']:
        assert package.read('reference-rebuild/'+name)==(OUT/name).read_bytes()
print('Review archive verified:',archive)
