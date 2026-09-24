"""Generate bundled VOICEVOX Nemo Japanese skill callouts.
Requires the official Nemo 0.23.0 engine on 127.0.0.1:50123.
Run: python scripts/build_audio.py
"""
from pathlib import Path
import json, urllib.request, urllib.parse, sys
OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
voices = [
 ('ember','狐ステップ！',10005,1.18,.08,1.28),
 ('nova','気のバースト！',10001,1.15,.13,1.35),
 ('cloud','ゴムターン！',10007,1.23,.06,1.3),
 ('eclipse','無限バリア！',10002,1.1,.10,1.15),
 ('purple','ホロウ・パープル！',10002,1.02,.10,1.2),
 ('spirit','元気玉！',10001,1.05,.13,1.35),
]
for name, text, speaker, speed, pitch, intonation in voices:
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    params=urllib.parse.urlencode({'text':text,'speaker':speaker})
    req=urllib.request.Request('http://127.0.0.1:50123/audio_query?'+params, method='POST')
    query=json.load(urllib.request.urlopen(req,timeout=60))
    query.update(speedScale=speed,pitchScale=pitch,intonationScale=intonation,volumeScale=.85,prePhonemeLength=.04,postPhonemeLength=.10,outputSamplingRate=24000)
    req=urllib.request.Request(f'http://127.0.0.1:50123/synthesis?speaker={speaker}', data=json.dumps(query).encode(),headers={'Content-Type':'application/json'})
    (OUT/f'{name}.wav').write_bytes(urllib.request.urlopen(req,timeout=120).read())
    print('Generated',name,flush=True)
credits={
 'speech':'VOICEVOX Nemo',
 'engine':'0.23.0',
 'terms':'https://voicevox.hiroshiba.jp/nemo/term/',
 'voices':[dict(zip(['file','text','speaker','speed','pitch','intonation'],v)) for v in voices],
}
(OUT/'credits.json').write_text(json.dumps(credits,ensure_ascii=False,indent=2),encoding='utf-8')
print('Japanese skill voice assets ready',flush=True)
