"""Bundle the published source snapshot and unretouched model/game evidence."""
from pathlib import Path
import sys,zipfile,json
from PIL import Image,ImageOps,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1]
site=Path(sys.argv[1])
out=root/'docs/kitsu-chibi-review'
sheet=Image.new('RGB',(1600,1170),'#13182b')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24)
draw=ImageDraw.Draw(sheet)
draw.text((24,16),'APPROVED KITSU / ACTUAL IN-GAME SCREENSHOTS',font=font,fill='#eeeeff')
def place(name,box):
    image=Image.open(out/name).convert('RGB')
    image=ImageOps.contain(image,(box[2],box[3]))
    sheet.paste(image,(box[0]+(box[2]-image.width)//2,box[1]+(box[3]-image.height)//2))
place('desktop-menu-dark.png',(16,64,1164,540))
place('phone-menu-dark.png',(1200,64,384,830))
place('desktop-leaf-game.png',(16,630,764,475))
place('desktop-cinematic-recovery.png',(800,630,380,475))
draw.text((24,600),'Desktop menu / Leaf gameplay / cinematic recovery / phone menu',font=font,fill='#ccccdf')
draw.text((24,1125),'1440 x 900 and 390 x 844 hardware Edge captures. No painted-over geometry.',font=font,fill='#ccccdf')
sheet.save(out/'in-game-comparison.jpg',quality=94)
archive=root.parent/'anime-coil-v1.7.2-kitsu-source.zip'
excluded={'.git','node_modules','dist','.vite','.codex','.sites-runtime','test-results','playwright-report'}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
    # Source/build inputs exactly match the publication checkout.
    for file in sorted(site.rglob('*')):
        rel=file.relative_to(site)
        if not file.is_file() or excluded.intersection(rel.parts) or file.suffix in {'.zip','.gz'}:continue
        bundle.write(file,'anime-coil/'+rel.as_posix())
    # Authoring source and prior asset candidates stay editable and preserved.
    saved=set(bundle.namelist())
    for directory in ['assets','scripts','docs']:
        for file in sorted((root/directory).rglob('*')):
            rel=file.relative_to(root)
            if not file.is_file() or excluded.intersection(rel.parts) or file.suffix in {'.zip','.blend1','.pyc'}:continue
            name='anime-coil/'+rel.as_posix()
            if name not in saved:
                bundle.write(file,name)
                saved.add(name)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for profile in ['desktop','mobile']:
        name=f'public/assets/kitsu/kitsu-head-{profile}.glb'
        assert bundle.read('anime-coil/'+name)==(site/name).read_bytes()
    assert bundle.read('anime-coil/assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend')==(root/'assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend').read_bytes()
print(json.dumps({'sourceArchive':str(archive),'sourceBytes':archive.stat().st_size,'inGameSheet':str(out/'in-game-comparison.jpg')}))
