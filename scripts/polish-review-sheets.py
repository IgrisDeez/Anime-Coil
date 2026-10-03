"""Lay out actual Blender renders and unretouched browser captures for review."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json
ROOT=Path(__file__).resolve().parents[1]
ROSTER=ROOT/'assets/roster/candidates'
OUT=ROOT/'docs/roster-review'
VFX=ROOT/'docs/ultimate-polish'
BG='#e9edf5';INK='#1f2a40';MUTED='#566079';DARK='#101525';WHITE='#e9ecf8'
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',size)
def text(sheet,xy,copy,size=22,fill=INK,bold=False):ImageDraw.Draw(sheet).text(xy,copy,fill=fill,font=font(size,bold))
def paste(sheet,p,box,background=BG):
    img=Image.open(p).convert('RGBA');fit=ImageOps.contain(img,(box[2],box[3]),Image.Resampling.LANCZOS)
    sheet.paste(Image.new('RGB',(box[2],box[3]),background),(box[0],box[1]))
    sheet.paste(fit,(box[0]+(box[2]-fit.width)//2,box[1]+(box[3]-fit.height)//2),fit)
OUT.mkdir(parents=True,exist_ok=True)
for name,identity in [('kairo','Directional black locks · compact blue eyes · confident expression'),('pomu','Fitted straw hat · shaped fringe · cheerful smile and small scar'),('shiro','Layered white hair · fitted blindfold · retained collar silhouette')]:
    folder=ROSTER/name/'renders';sheet=Image.new('RGB',(1800,680),BG)
    text(sheet,(36,22),name.title()+' · Blender head candidate',32,bold=True)
    text(sheet,(36,68),identity,22,fill=MUTED)
    for i,(label,key) in enumerate([('Front','front'),('Three-quarter','three-quarter'),('Side','side'),('Rear','back')]):
        paste(sheet,folder/(key+'.png'),(i*450,106,450,475));text(sheet,(i*450+24,593),label,23,bold=True)
    text(sheet,(36,641),'Actual studio renders · separate editable model · awaiting visual approval',19,fill=MUTED)
    sheet.save(OUT/(name+'-four-views.png'))
    sheet=Image.new('RGB',(1600,1120),BG);text(sheet,(32,22),name.title()+' · Current head / Blender candidate',32,bold=True)
    for row,(label,key) in enumerate([('Current game head','baseline-'),('Blender candidate','')]):
        text(sheet,(32,96+row*478),label,24,bold=True)
        for col,view in enumerate(['front','side','three-quarter']):paste(sheet,folder/(key+view+'.png'),(col*520+12,130+row*478,516,440))
    text(sheet,(32,1073),'Same studio camera, lighting and scale. Candidates remain separate from the default game.',20,fill=MUTED)
    sheet.save(OUT/(name+'-comparison.png'))
    sheet=Image.new('RGB',(1600,654),BG);text(sheet,(32,22),name.title()+' · Original coil attachment study',32,bold=True)
    for i,view in enumerate(['front','three-quarter','side']):paste(sheet,folder/('coil-fit-'+view+'.png'),(i*530,86,530,505))
    text(sheet,(32,608),'Existing mount dimensions and 0.12 Y sculpt offset · Y up · +Z forward · head only',20,fill=MUTED)
    sheet.save(OUT/(name+'-coil-fit.png'))

sheet=Image.new('RGB',(1800,1535),DARK);text(sheet,(30,20),'Ultimate VFX · 1.7.4 / 1.7.5',32,WHITE,True)
text(sheet,(30,69),'Actual held game captures · 21 snakes · Shibuya · desktop profile',22,'#b6bfd5')
for row,(kind,name) in enumerate([('fox','Kitsu · Fox Rush'),('spirit','Kairo · Spirit Bomb'),('skybreaker','Pomu · Skybreaker'),('purple','Shiro · Hollow Purple')]):
    y=120+row*345;text(sheet,(30,y),name,24,WHITE,True)
    for col,(candidate,phase,label) in enumerate([('baseline','charge','Before · charge'),('polished','charge','After · charge'),('baseline','hit','Before · impact'),('polished','hit','After · impact')]):
        paste(sheet,VFX/f'desktop-{kind}-{candidate}-{phase}.png',(col*450+8,y+36,434,268),DARK);text(sheet,(col*450+16,y+307),label,18,'#b6bfd5')
sheet.save(VFX/'comparison.png')
sheet=Image.new('RGB',(1840,1295),DARK);text(sheet,(30,20),'Ultimate VFX · Charge, release, impact, pressure wave and recovery',30,WHITE,True)
for row,(kind,name) in enumerate([('fox','Kitsu'),('spirit','Kairo'),('skybreaker','Pomu'),('purple','Shiro')]):
    y=94+row*296;text(sheet,(30,y),name,23,WHITE,True)
    for col,(phase,label) in enumerate([('charge','Charge'),('release','Release'),('hit','Hit'),('shockwave','Pressure wave'),('recovery','Recovery')]):
        paste(sheet,VFX/f'desktop-{kind}-polished-{phase}.png',(col*368+8,y+31,352,220),DARK);text(sheet,(col*368+16,y+254),label,18,'#b6bfd5')
sheet.save(VFX/'timeline.png')
sheet=Image.new('RGB',(1640,880),DARK);text(sheet,(30,20),'Roster candidates · Original menu coil and phone framing',30,WHITE,True)
for i,name in enumerate(['kairo','pomu','shiro']):
    x=i*546;text(sheet,(x+24,76),name.title(),24,WHITE,True)
    paste(sheet,OUT/f'desktop-{name}-candidate-menu.png',(x+10,116,376,565),DARK)
    paste(sheet,OUT/f'phone-{name}-candidate-menu.png',(x+391,116,144,565),DARK)
    text(sheet,(x+24,712),'Original bodies and cosmetics retained',18,'#b6bfd5')
text(sheet,(30,813),'Staged local review only. The published game keeps its current normal heads until approval.',20,'#b6bfd5')
sheet.save(OUT/'menu-coil-review.png')
print('Actual render comparison sheets created.')
