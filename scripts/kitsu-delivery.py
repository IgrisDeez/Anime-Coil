"""Assemble reference/render comparisons and a representative screenshot sheet."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
BASE=Path(__file__).resolve().parents[1];ASSET=BASE/'assets/kitsu';REVIEW=BASE.parent/'v169-review'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',24)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',19)
def fit(image,box):
 image=image.convert('RGBA');image.thumbnail(box,Image.Resampling.LANCZOS);return image
def place(sheet,image,rect):
 x,y,w,h=rect
 if image.mode=='RGBA' and image.getextrema()[-1][0]==0:image=image.crop(image.getchannel('A').getbbox())
 image=fit(image,(w,h));sheet.paste(image,(x+(w-image.width)//2,y+(h-image.height)//2),image)
ref=Image.open(ASSET/'reference-four-view.png')
sheet=Image.new('RGB',(1600,930),'#fffdf8');d=ImageDraw.Draw(sheet)
d.text((30,16),'ANIME COIL 1.6.9  /  KITSU REFERENCE COMPARISON',font=font,fill='#292b3e')
labels=['Front','Three-quarter','Side','Rear'];crops=[(115,0,700,545),(754,0,1396,545),(110,550,710,1065),(780,550,1338,1065)]
for i,(name,crop) in enumerate(zip(labels,crops)):
 x=i*400;d.text((x+28,58),name,font=small,fill='#515366')
 place(sheet,ref.crop(crop),(x+10,88,380,370))
 place(sheet,Image.open(ASSET/(name.lower().replace(' ','-')+'.png')),(x+10,496,380,385))
d.text((28,468),'SUPPLIED REFERENCE ABOVE  /  EDITABLE BLENDER SCULPT BELOW',font=small,fill='#515366')
d.text((28,896),'Y up, +Z forward  |  5,341 desktop / 3,620 mobile asset triangles  |  10 head batches + retained coil + outline',font=small,fill='#515366')
sheet.save(ASSET/'four-view-comparison.png')
shots=Image.new('RGB',(1600,1000),'#fffdf8');d=ImageDraw.Draw(shots)
d.text((24,18),'ANIME COIL 1.6.9  /  REPRESENTATIVE IN-GAME REVIEW',font=font,fill='#292b3e')
for label,file,rect in [('Desktop menu - light','desktop-menu-light.png',(20,92,960,510)),('Phone menu - dark','phone-menu-dark.png',(1000,92,290,510)),('Phone / Hidden Leaf','phone-leaf-game.png',(1300,92,280,510)),('Shibuya / large same-character crowd','desktop-shibuya-crowd.png',(20,654,760,310)),('Grand Line Harbor / large crowd','desktop-harbor-crowd.png',(800,654,780,310))]:
 d.text((rect[0],rect[1]-24),label,font=small,fill='#515366');place(shots,Image.open(REVIEW/file),rect)
shots.save(ASSET/'in-game-review-sheet.png')
correction=Image.new('RGB',(1500,1090),'#fffdf8');d=ImageDraw.Draw(correction)
d.text((24,16),'KITSU 1.6.9 / ALIGNMENT AND SCULPT CORRECTION',font=font,fill='#292b3e')
for title,path,rect in [('Previous sculpture',ASSET/'front-before-correction.png',(10,78,480,455)),('Corrected sculpture',ASSET/'front.png',(510,78,480,455)),('Corrected side fit',ASSET/'side.png',(1010,78,480,455))]:
 d.text((rect[0]+20,rect[1]-24),title,font=small,fill='#515366');place(correction,Image.open(path),rect)
d.text((24,555),'Corrected local menu / original coil attachment retained',font=small,fill='#515366')
place(correction,Image.open(REVIEW/'desktop-menu-light.png'),(10,588,1010,478))
place(correction,Image.open(REVIEW/'phone-menu-dark.png'),(1040,588,260,478))
correction.save(ASSET/'alignment-correction.png')
# Compare unchanged preexisting simulation/profiler hunks with the recorded snapshot.
def chunks(path):
 text=path.read_text(encoding='utf-8').replace('\r\n','\n');return {'diff --git '+p.split('\n',1)[0]:'diff --git '+p for p in text.split('diff --git ')[1:]}
before=chunks(ASSET/'preexisting-changes.patch');after=chunks(REVIEW/'preserved-source.patch')
for key,value in after.items():
 assert before[key]==value, 'Preexisting simulation/profiler changes were altered: '+key
print('Comparison sheets saved; existing simulation and profiler diffs preserved exactly.')
