"""Meshbreakers original score. Notes, orchestration and instruments are authored here.
Run: python soundtrack/compose.py (NumPy + FFmpeg). Produces game-ready MP3s.
No samples, remote music services, or third-party compositions are used.
"""
from pathlib import Path
import numpy as np
import wave, subprocess, json, tempfile
RATE=32000
ROOT=Path(__file__).resolve().parents[1]
RNG=np.random.default_rng(42871)
# The five-note resistance motif: D–A–C–F–E. Each cue develops it differently.
CHORDS={
 'Dm':[50,57,62,65,69], 'Bb':[46,53,58,62,65], 'F':[41,53,57,60,65],
 'C':[48,55,60,64,67], 'Gm':[43,55,58,62,67], 'A':[45,52,57,61,64],
 'Am':[45,52,57,60,64], 'Eb':[39,51,55,58,63], 'Ds':[50,57,62,67,69],
}
# Explicit melodic phrases (MIDI pitch, duration in beats). Rests use None.
THEME=[
 [(74,1.5),(69,.5),(72,1),(77,1)],[(76,1.5),(72,.5),(69,1),(None,1)],
 [(70,1),(74,1),(77,1.5),(74,.5)],[(72,2),(69,1),(67,1)],
 [(65,1),(69,.5),(72,.5),(77,1),(76,1)],[(74,1.5),(72,.5),(69,1),(65,1)],
 [(67,1),(70,1),(74,1),(72,1)],[(73,1),(76,1),(69,1),(None,1)],
 [(74,1),(81,1),(79,.5),(77,.5),(76,1)],[(77,2),(74,1),(72,1)],
 [(70,.5),(74,.5),(77,1),(79,1),(77,1)],[(76,1),(72,1),(67,2)],
 [(77,1.5),(76,.5),(74,1),(72,1)],[(69,1),(65,1),(64,1),(62,1)],
 [(67,1),(70,1),(74,.5),(76,.5),(77,1)],[(76,1),(73,1),(74,2)],
]
FIGHT=[
 [(74,.5),(69,.5),(72,.5),(77,.5),(76,1),(74,1)],[(69,.5),(72,.5),(74,1),(77,1),(76,1)],
 [(70,.5),(74,.5),(77,1),(74,.5),(70,.5),(69,1)],[(67,.5),(72,.5),(76,1),(74,1),(72,1)],
 [(77,.5),(76,.5),(72,.5),(69,.5),(65,1),(69,1)],[(74,1),(72,.5),(69,.5),(65,1),(64,1)],
 [(67,.5),(70,.5),(74,1),(77,.5),(74,.5),(70,1)],[(73,.5),(76,.5),(81,1),(76,1),(73,1)],
]
DRAGON=[
 [(62,.5),(69,.5),(65,.5),(64,.5),(62,1),(None,1)],[(63,1),(67,.5),(70,.5),(74,1),(70,1)],
 [(65,.5),(69,.5),(72,1),(77,.5),(76,.5),(74,1)],[(73,.5),(76,.5),(69,1),(64,1),(61,1)],
 [(74,1),(77,.5),(81,.5),(79,1),(77,1)],[(75,1),(74,1),(70,.5),(67,.5),(63,1)],
 [(79,.5),(77,.5),(74,1),(70,1),(67,1)],[(73,1),(76,1),(81,1),(None,1)],
]
CUES=[
 dict(id='title',name='A Light Between Seconds',bpm=86,bars=32,progress=['Dm','Bb','F','C','Dm','Bb','Gm','A'],melody=THEME,kind='title'),
 dict(id='battle',name='A Hundred Small Rebellions',bpm=124,bars=32,progress=['Dm','Dm','Bb','C','F','Dm','Gm','A'],melody=FIGHT,kind='battle'),
 dict(id='boss',name='The Hour That Devours',bpm=132,bars=32,progress=['Dm','Eb','F','A','Dm','Eb','Gm','A'],melody=DRAGON,kind='boss'),
 dict(id='refuge',name='Somewhere the Rain Can Find Us',bpm=76,bars=24,progress=['Bb','F','C','Dm','Gm','Dm','Bb','A'],melody=THEME,kind='refuge'),
 dict(id='victory',name='Tomorrow Is Ours',bpm=96,bars=8,progress=['Dm','Bb','F','C','Gm','Bb','A','Ds'],melody=THEME[8:],kind='victory'),
]
def freq(m): return 440*2**((m-69)/12)
def voice(midi,duration,kind,vel):
 f=freq(midi); tail={'piano':1.5,'bell':2.2,'strings':.55,'pluck':.4,'bass':.08,'lead':.28}[kind]
 t=np.arange(int((duration+tail)*RATE))/RATE
 if kind=='piano':
  # Detuned string pairs with frequency-dependent inharmonicity and hammer attack.
  x=np.zeros_like(t)
  for h in range(1,9):
   partial=f*h*np.sqrt(1+.00016*h*h)
   if partial>RATE*.45:continue
   decay=np.exp(-t*(.9+h*.43+(midi-48)*.018))
   x+=(np.sin(2*np.pi*partial*t)+.24*np.sin(2*np.pi*partial*1.0013*t))*.52/h**1.6*decay
  x+=RNG.normal(0,.018,len(t))*np.exp(-t*160)
  x*=np.minimum(1,t/.005)*np.exp(-np.maximum(0,t-duration)*4)
 elif kind=='strings':
  x=np.zeros_like(t)
  for h in range(1,7):
   if f*h>RATE*.45:continue
   x+=sum(np.sin(2*np.pi*(f*h*det)*t+.005*np.sin(2*np.pi*4.6*t)) for det in [.9987,1.0002,1.0018])/3/h**1.5
  x*=np.minimum(1,t/.24)*np.minimum(1,np.maximum(0,duration+.55-t)/.55)*.33
 elif kind=='bell':
  x=(np.sin(2*np.pi*f*t)*np.exp(-t*1.7)+.28*np.sin(2*np.pi*f*2.003*t)*np.exp(-t*3.1)+.09*np.sin(2*np.pi*f*3.98*t)*np.exp(-t*5))*.55*np.minimum(1,t/.006)
 elif kind=='pluck':
  x=sum(np.sin(2*np.pi*f*h*t)/h**1.6 for h in range(1,5))*.45*np.exp(-t*7)*np.minimum(1,t/.004)
 elif kind=='bass':
  x=(np.sin(2*np.pi*f*t)+.15*np.sin(4*np.pi*f*t))*.65*np.minimum(1,t/.012)*np.minimum(1,np.maximum(0,duration+.08-t)/.08)
 else:
  x=(np.sin(2*np.pi*f*t+.014*np.sin(2*np.pi*5*t))+.25*np.sin(4*np.pi*f*t)+.09*np.sin(6*np.pi*f*t))*.42*np.minimum(1,t/.025)*np.minimum(1,np.maximum(0,duration+.28-t)/.28)
 return (x*vel).astype(np.float32)
def percussion(kind):
 dur={'kick':.4,'snare':.22,'hat':.085,'timpani':.7,'cymbal':1.8}[kind];t=np.arange(int(RATE*dur))/RATE
 noise=RNG.normal(0,1,len(t)); bright=noise-np.r_[0,noise[:-1]]
 if kind=='kick':x=np.sin(2*np.pi*(47*t+8*(1-np.exp(-t*25))))*np.exp(-t*12)+noise*.02*np.exp(-t*150)
 elif kind=='snare':x=bright*.22*np.exp(-t*23)+np.sin(2*np.pi*185*t)*.25*np.exp(-t*25)
 elif kind=='hat':x=bright*.09*np.exp(-t*65)
 elif kind=='timpani':x=(np.sin(2*np.pi*(63*t+.4*(1-np.exp(-t*15))))+.23*np.sin(2*np.pi*92*t))*np.exp(-t*7)
 else:x=bright*.08*np.exp(-t*2.7)
 return x.astype(np.float32)
def render(cue):
 beat=60/cue['bpm'];length=cue['bars']*4*beat;frames=round(length*RATE)
 dry=np.zeros((frames+RATE*3,2),np.float32); events=[]
 def add(pitch,when,beats,instrument,velocity=.2,pan=0):
  if pitch is None:return
  audio=voice(pitch,beats*beat,instrument,velocity)
  start=max(0,round((when*beat)*RATE));end=min(len(dry),start+len(audio));audio=audio[:end-start]
  gains=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)],np.float32)
  dry[start:end]+=audio[:,None]*gains
  events.append(dict(note=pitch,beat=round(when,3),length=beats,instrument=instrument,velocity=velocity))
 def drum(kind,when,volume,pan=0):
  audio=percussion(kind)*volume;start=round(when*beat*RATE);end=min(len(dry),start+len(audio));g=np.array([.707-pan*.2,.707+pan*.2])
  dry[start:end]+=audio[:end-start,None]*g
 for bar in range(cue['bars']):
  chord=CHORDS[cue['progress'][bar%8]];base=bar*4;kind=cue['kind'];section=bar//8
  intensity=[.62,.85,1,.78][min(section,3)]
  if kind=='refuge':intensity*=.65
  if kind=='victory':intensity=.85
  for j,n in enumerate(chord[1:]):add(n,base+.025*j,3.8,'strings',.17*intensity,(j-1.5)*.3)
  add(chord[0]-12 if chord[0]>45 else chord[0],base,1.8 if kind in ['battle','boss'] else 3.5,'bass',.27*intensity)
  if kind in ['battle','boss']:add(chord[0],base+2,1.4,'bass',.2*intensity)
  arpeggio=[1,2,3,2,4,3,2,3] if kind!='boss' else [1,3,2,4,1,3,2,4]
  for k,degree in enumerate(arpeggio):
   add(chord[degree]+(12 if kind in ['title','refuge'] else 0),base+k*.5,.45,'piano' if kind in ['title','refuge'] else 'pluck',(.1 if k%2 else .14)*intensity,-.35+ .1*(k%3))
  phrase=cue['melody'][bar%len(cue['melody'])]
  t=0
  # An exposed piano opening develops into a wider lead in the middle eight.
  for pitch,duration in phrase:
   transpose=-12 if kind=='refuge' else 12 if kind=='boss' and section==2 else 0
   add(None if pitch is None else pitch+transpose,base+t,duration*.9,'piano' if kind in ['title','refuge'] else 'lead',.31*intensity,.15)
   if section==2 and pitch is not None:add(pitch-12,base+t,duration*.95,'strings',.14,-.15)
   t+=duration
  if bar%4==0:add(chord[-1]+12,base,.7,'bell',.11,.45)
  if kind in ['battle','boss']:
   for step in [0,1.5,2,3.5]:drum('kick',base+step,.29*intensity)
   for step in [1,3]:drum('snare',base+step,.3*intensity,.2)
   for step in range(8):drum('hat',base+step*.5,.32*intensity,-.35)
   if bar%4==0:drum('cymbal',base,.8*intensity,.5)
   if kind=='boss':drum('timpani',base,.22);drum('timpani',base+2.5,.16)
   if bar%8==7:
    for step in [2.5,3,3.25,3.5,3.75]:drum('snare',base+step,.15+.04*(step-2.5))
  elif kind=='victory' or section in [1,2] and kind=='title':
   drum('timpani',base,.12*intensity)
 # Stereo tapped ambience, with the end's reverb wrapped into the loop head.
 wet=dry.copy()
 for delay,gain in [(0.087,.12),(.173,.11),(.293,.09),(.431,.08),(.613,.055),(.827,.04),(1.13,.025)]:
  n=int(delay*RATE);wet[n:]+=dry[:-n,::-1]*gain
 out=wet[:frames].copy();tail=wet[frames:];out[:len(tail)]+=tail
 out=np.tanh(out*1.25)
 peak=float(np.max(np.abs(out)));out*=.79/max(peak,.01)
 # Eight-millisecond boundary fades prevent a click while preserving the musical loop.
 ramp=np.linspace(0,1,256);out[:256]*=ramp[:,None];out[-256:]*=ramp[::-1,None]
 if cue['kind']=='victory':out[-RATE*2:]*=np.linspace(1,0,RATE*2)[:,None]
 dest=ROOT/'public/music'/f"{cue['id']}.mp3"
 with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
  with wave.open(tmp.name,'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((out*32767).astype('<i2').tobytes())
  subprocess.run(['ffmpeg','-y','-v','error','-i',tmp.name,'-codec:a','libmp3lame','-b:a','128k','-metadata',f"title={cue['name']}",'-metadata','artist=Meshbreakers — Dakota Rain Lock & GPT Astra',str(dest)],check=True)
 (ROOT/'soundtrack'/f"{cue['id']}.score.json").write_text(json.dumps({'title':cue['name'],'bpm':cue['bpm'],'bars':cue['bars'],'events':events},separators=(',',':'))+'\n')
 print(f"{cue['name']}: {length:.1f}s, peak {np.max(np.abs(out)):.3f}, RMS {np.sqrt(np.mean(out**2)):.3f}",flush=True)
for cue in CUES:render(cue)
