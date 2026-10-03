"""Compose actual browser captures and phase-aligned gameplay recordings for review."""
from pathlib import Path
from io import BytesIO
import json, subprocess
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/ultimate-catastrophe'
KINDS=[('fox','Kitsu · Fox Rush'),('spirit','Kairo · Spirit Bomb'),('purple','Shiro · Hollow Purple'),('skybreaker','Pomu · Skybreaker')]
BG='#101525';FG='#e9ecf8';MUTED='#b6bfd5'
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',size)
def text(sheet,xy,copy,size=22,fill=FG,bold=False):ImageDraw.Draw(sheet).text(xy,copy,fill=fill,font=font(size,bold))
def paste(sheet,image,box):
    image=Image.open(image).convert('RGB') if isinstance(image,Path) else image
    fit=ImageOps.contain(image,(box[2],box[3]),Image.Resampling.LANCZOS)
    sheet.paste(fit,(box[0]+(box[2]-fit.width)//2,box[1]+(box[3]-fit.height)//2))

sheet=Image.new('RGB',(1800,1520),BG)
text(sheet,(30,20),'Anime Coil · Catastrophic ultimate VFX review',32,bold=True)
text(sheet,(30,67),'Current 1.7.5 / 1.7.6 candidate · actual held 21-snake captures · identical stage times',22,MUTED)
for row,(kind,name) in enumerate(KINDS):
    y=115+row*340;text(sheet,(24,y),name,24,bold=True)
    for col,(version,phase,label) in enumerate([('v175','charge','Before · charge'),('candidate','charge','Candidate · charge'),('v175','expansion','Before · expansion'),('candidate','expansion','Candidate · expansion')]):
        paste(sheet,OUT/f'desktop-{kind}-{version}-{phase}.png',(col*450+8,y+34,434,270))
        text(sheet,(col*450+16,y+305),label,18,MUTED)
text(sheet,(30,1483),'Held crowds stay alive for rendering comparison. Live gameplay still wipes all 20 opponents at 3.4 seconds.',18,MUTED)
sheet.save(OUT/'comparison.png')

sheet=Image.new('RGB',(1920,1360),BG)
text(sheet,(30,18),'Candidate · charge, compression, expansion, long-range pressure, aftermath',29,bold=True)
for row,(kind,name) in enumerate(KINDS):
    y=83+row*310;text(sheet,(24,y),name,22,bold=True)
    for col,(phase,label) in enumerate([('charge','Charge · 2.15 s'),('compression','Compression · 3.30 s'),('expansion','Expansion · 3.65 s'),('long-range','Long range · 3.95 s'),('aftermath','Aftermath · 4.55 s')]):
        paste(sheet,OUT/f'desktop-{kind}-candidate-{phase}.png',(col*384+8,y+30,368,234))
        text(sheet,(col*384+14,y+269),label,18,MUTED)
sheet.save(OUT/'timeline.png')

sheet=Image.new('RGB',(1760,400),BG)
text(sheet,(24,16),'The first authoritative kill render · actual application keyframes',28,bold=True)
for col,(kind,name) in enumerate(KINDS):
    paste(sheet,OUT/'application'/f'desktop-{kind}-exact-keyframe.png',(col*440+8,66,424,270))
    text(sheet,(col*440+14,347),name,20,MUTED)
sheet.save(OUT/'exact-keyframes.png')

sheet=Image.new('RGB',(1640,1000),BG)
text(sheet,(24,16),'Phone-width review · real application · 390 × 844 · DPR 1',29,bold=True)
for col,(kind,name) in enumerate(KINDS):
    text(sheet,(col*410+16,74),name,21,bold=True)
    paste(sheet,OUT/'application'/f'phone-{kind}-expansion.png',(col*410+14,115,380,805))
text(sheet,(24,951),'Responsive browser captures; physical-phone touch, GPU, thermal behavior and sustained play are unverified.',20,MUTED)
sheet.save(OUT/'phone-review.png')

# The trace maps simulation time to browser wall time. Recorded video is 25 fps;
# this review montage resamples to 12 fps and has approximate phase alignment.
def video_frames(folder,kind):
    report=json.loads((OUT/folder/'live-wipe-validation.json').read_text())
    trace=next(r['trace'] for r in report['results'] if r['label']=='desktop' and r['kind']==kind)
    times=np.array([r['time'] for r in trace]);wall=np.array([r['wallMs']/1000 for r in trace])
    cap=cv2.VideoCapture(str(OUT/folder/f'desktop-{kind}.webm'));assert cap.isOpened()
    frames=[]
    for t in np.linspace(.75,5.6,60):
        cap.set(cv2.CAP_PROP_POS_MSEC,float(np.interp(t,times,wall))*1000)
        ok,frame=cap.read();assert ok
        frames.append(Image.fromarray(cv2.cvtColor(cv2.resize(frame,(472,295),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGB)))
    cap.release();return frames

videos={(version,kind):video_frames(folder,kind) for version,folder in [('before','v175-application'),('candidate','application')] for kind,_ in KINDS}
candidate_frames=[];comparison_frames=[]
for i in range(60):
    candidate=Image.new('RGB',(960,740),BG)
    text(candidate,(16,10),'Anime Coil · 1.7.6 VFX candidate',25,bold=True)
    text(candidate,(16,46),'Actual live wipes · charge → impact → recovery',17,MUTED)
    comparison=Image.new('RGB',(960,1390),BG)
    text(comparison,(16,10),'Animated comparison · current 1.7.5 / 1.7.6 candidate',23,bold=True)
    text(comparison,(16,47),'Actual game recordings · approximately aligned by simulation time',16,MUTED)
    text(comparison,(16,81),'Before · 1.7.5',19,bold=True);text(comparison,(496,81),'Candidate',19,bold=True)
    for row,(kind,name) in enumerate(KINDS):
        x=(row%2)*480;y=88+(row//2)*320
        text(candidate,(x+12,y),name,19,bold=True);candidate.paste(videos['candidate',kind][i],(x+4,y+25))
        cy=115+row*315
        text(comparison,(12,cy),name,18,bold=True)
        comparison.paste(videos['before',kind][i],(4,cy+23));comparison.paste(videos['candidate',kind][i],(484,cy+23))
    candidate_frames.append(candidate);comparison_frames.append(comparison)

gif_frames=[frame.resize((720,555),Image.Resampling.LANCZOS).quantize(colors=128,method=Image.Quantize.FASTOCTREE) for frame in candidate_frames]
gif_frames[0].save(OUT/'animated-preview.gif',save_all=True,append_images=gif_frames[1:],duration=83,loop=0,optimize=True)
ffmpeg=Path('C:/Users/denze/AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe')
for name,frames in [('animated-preview',candidate_frames),('animated-comparison',comparison_frames)]:
    with (OUT/(name+'-encode.txt')).open('wb') as log:
        process=subprocess.Popen([str(ffmpeg),'-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-r','12','-i','pipe:0','-an','-c:v','libvpx','-b:v','2200k','-deadline','realtime','-y',str(OUT/(name+'.webm'))],stdin=subprocess.PIPE,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        for frame in frames:
            buffer=BytesIO();frame.save(buffer,format='JPEG',quality=92);process.stdin.write(buffer.getvalue())
        process.stdin.close();assert process.wait()==0
(OUT/'media-method.json').write_text(json.dumps({'sources':'Unretouched browser PNGs and actual production-game WebM recordings','montage':'Trace-based simulation-time resampling, approximate 25-fps capture alignment; 12-fps montage','keyframes':'Browser scheduling held immediately after real kill render, with unchanged simulation and DOM/Three.js presentation','retouching':False},indent=2)+'\n')
print(json.dumps({'images':4,'animatedFiles':3,'framesPerMontage':60,'sources':'actual gameplay'}))
