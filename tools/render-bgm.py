"""Render four original loopable scores. No third-party samples or downloads."""
from pathlib import Path
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SCORES = json.loads((ROOT / 'assets/audio/scores.json').read_text(encoding='utf-8'))
SR = SCORES['sampleRate']

def render(mode, score):
    rng = np.random.default_rng({'menu': 19, 'walk': 27, 'panic': 41, 'fomo': 53}[mode])
    beat = 60 / score['bpm']
    length = int(round(score['bars'] * 4 * beat * SR))
    out = np.zeros((length, 2), dtype=np.float64)

    def put(signal, when, amp=1, pan=0):
        start = int(round(when * SR)) % length
        signal = signal * amp
        stereo = signal[:, None] * np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])[None, :]
        # Circular mixing carries release/reverb tails over the loop boundary.
        if start + len(signal) <= length:
            out[start:start+len(signal)] += stereo
        else:
            n = length-start
            out[start:] += stereo[:n]
            out[:len(signal)-n] += stereo[n:]

    def note(midi, when, duration, voice='piano', amp=.1, pan=0):
        if not midi:
            return
        t = np.arange(int(max(.04, duration) * SR)) / SR
        f = 440 * 2 ** ((midi-69)/12)
        if voice == 'piano':
            y = sum(a*np.sin(2*np.pi*f*k*t)*np.exp(-t*(2.1+k*.4)) for k,a in [(1,1),(2,.32),(3,.13),(4,.055)])
            env = np.minimum(1, t/.006) * np.minimum(1, (duration-t)/.09)
        elif voice == 'bell':
            y = np.sin(2*np.pi*f*t)*np.exp(-t*4) + .22*np.sin(2*np.pi*f*2*t)*np.exp(-t*7)
            env = np.minimum(1,t/.004)*np.minimum(1,(duration-t)/.08)
        elif voice == 'pluck':
            y = sum(np.sin(2*np.pi*f*k*t)/k**1.8 for k in [1,2,3,4,5]) * np.exp(-t*7)
            env = np.minimum(1,t/.004)*np.minimum(1,(duration-t)/.05)
        elif voice == 'bass':
            y = np.sin(2*np.pi*f*t)+.16*np.sin(2*np.pi*f*2*t)
            env = np.minimum(1,t/.012)*np.minimum(1,(duration-t)/.08)*np.exp(-t*1.4)
        else:
            y = sum(np.sin(2*np.pi*f*k*t + .012*np.sin(2*np.pi*.6*t))/k**2 for k in [1,2,3,4])
            env = np.minimum(1,t/.16)*np.minimum(1,(duration-t)/.24)
        put(y*np.maximum(0,env),when,amp,pan)

    def drum(kind, when, amp=.1, pan=0):
        duration = .25 if kind == 'kick' else .11
        t=np.arange(int(SR*duration))/SR
        if kind == 'kick':
            y=np.sin(2*np.pi*(48*t+8*(1-np.exp(-t*35))))*np.exp(-t*22)
        else:
            noise=rng.standard_normal(len(t))
            noise=np.concatenate(([0], np.diff(noise))) * .3
            y=noise*np.exp(-t*(90 if kind=='hat' else 36))
            if kind == 'snare':
                y += .2*np.sin(2*np.pi*180*t)*np.exp(-t*40)
        y *= np.minimum(1,t/.002)*np.maximum(0,np.minimum(1,(duration-t)/.02))
        put(y,when,amp,pan)

    for bar in range(score['bars']):
        chord=score['chords'][bar % len(score['chords'])]
        base=bar*4*beat
        melody=score['melody'][bar % len(score['melody'])]
        for j,m in enumerate(melody):
            extra = 12 if bar >= 8 and j in [2,6] and mode in ['walk','fomo'] else 0
            note(m+extra if m else 0,base+j*.5*beat,beat*(1.25 if mode=='menu' else .8),
                 'piano' if mode=='menu' else 'bell' if mode=='walk' else 'pluck',
                 .11 if mode=='panic' else .14, -.12)
        if mode=='menu':
            for k,m in enumerate(chord):
                note(m+12,base+k*.025,beat*3.6,'piano',.055,(-.4+k*.25))
            for j in [0,2]:
                note(chord[0]-12 if j==0 else chord[2]-12,base+j*beat,beat*1.5,'bass',.12,.05)
            for j in range(8): drum('hat',base+(j*.5+(0.08 if j%2 else 0))*beat,.04,.35)
            for j in [1,3]: drum('snare',base+j*beat,.045,-.25)
            drum('kick',base,.12)
        elif mode=='walk':
            for j in range(4):
                note(chord[0]-12 if j%2==0 else chord[2]-12,base+j*beat,beat*.7,'bass',.13,.05)
                for k,m in enumerate(chord[1:]): note(m+12,base+(j+.5)*beat,beat*.5,'pluck',.055,-.35+k*.3)
            for j in range(8): drum('hat',base+j*.5*beat,.055,.35)
            for j in [0,2]: drum('kick',base+j*beat,.15)
            for j in [1,3]: drum('snare',base+j*beat,.075,-.2)
        elif mode=='panic':
            for k,m in enumerate(chord): note(m+12,base,beat*4,'pad',.05,-.45+k*.3)
            for j in range(8):
                note(chord[0]-12,base+j*.5*beat,beat*.34,'bass',.1,.03)
                note(chord[j%4]+12,base+j*.5*beat,beat*.42,'pluck',.065,.3)
                drum('hat',base+j*.5*beat,.055,-.35)
            for j in [0,1.5,2,3.5]: drum('kick',base+j*beat,.16)
            for j in [1,3]: drum('snare',base+j*beat,.09,.15)
        else:
            for j in range(16):
                note(chord[j%4]+12+(12 if j>=12 else 0),base+j*.25*beat,beat*.38,'bell',.036,-.45 if j%2 else .45)
            for j in [0,.75,1.5,2.5,3.25]: note(chord[0]-12,base+j*beat,beat*.5,'bass',.14,.02)
            for j in range(8): drum('hat',base+j*.5*beat,.052,.35)
            for j in [0,2]: drum('kick',base+j*beat,.16)
            for j in [1,3]: drum('snare',base+j*beat,.085,-.2)
    # Subtle stereo echoes are wrapped, so loops retain a natural tail.
    dry=out.copy()
    for delay,gain in [(.13,.12),(.23,.075),(.37,.045)]:
        out += np.roll(dry[:, ::-1],int(delay*SR),axis=0)*gain
    peak=max(.001,float(np.max(np.abs(out))))
    out=np.tanh(out/peak*1.1)*.72
    pcm=np.round(np.clip(out,-1,1)*32767).astype('<i2')
    destination=ROOT/'assets/audio'/f'{mode}.wav'
    with wave.open(str(destination),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    rms=float(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))
    print(f'{mode}: {len(pcm)/SR:.2f}s, peak={int(abs(pcm.astype(int)).max())}, RMS={rms:.3f}, {destination.stat().st_size:,} bytes')
    return {'title':score['title'],'mood':score['mood'],'bpm':score['bpm'],'duration':round(len(pcm)/SR,3),'src':f'assets/audio/{mode}.wav'}

manifest={key:render(key,score) for key,score in SCORES['tracks'].items()}
(ROOT/'assets/audio/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
