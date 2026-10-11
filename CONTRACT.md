# Stick Fight! — module contract (all agents follow this exactly)

Plain ES modules, no build step, no dependencies. Canvas logical size 1280x720.
Files: `index.html` (done), `bosses.js` (done), `audio.js`, `art.js`, `game.js`.

## Game concept
Cartoon/goofy drum battle. Hero = tiny garage-band kid with a CARDBOARD drum kit (left, faces right).
Boss ladder (right, faces left): Rocco the Grumpy Raccoon (alley) → Octavia the Disco Octopus (disco)
→ TIK-TOK 3000 the Robot Metronome (lab) → Maestro Kaboom the Volcano (volcano).
Each round: boss plays a 1-bar pattern ("LISTEN"), next bar the player copies it ("YOUR TURN").
Accurate hits fire music-note projectiles that damage the boss; misses hurt the hero and trigger
trash-talk speech bubbles. Party-friendly timing. Keys: D=hihat F=kick J=snare K=tom. Space/Enter/click = advance, M = mute, Esc = title.

Drums: `'hihat' | 'kick' | 'snare' | 'tom'`. Colors: hihat #38d9ff, kick #ff4d6d, snare #ffd43b, tom #69db7c.

## audio.js — `export class Sound`
- `init()` — create AudioContext lazily on first user gesture (+ master gain → compressor → destination, a 1 s white-noise buffer); resume if suspended. Safe to call repeatedly.
- `get ready` (bool), `get now` (ctx.currentTime, or performance.now()/1000 before init)
- `latency()` → outputLatency + baseLatency (0 if unknown)
- `toggleMute()`
- `drum(type, t, {vol=1, pitch=1, dull=false}={})` → returns array of AudioScheduledSourceNodes (so callers can `.stop()` future ones). Synthesized: kick = sine sweep 170→45 Hz; snare = highpassed noise + triangle body; hihat = very short highpassed noise; tom = sine sweep 260→130. `pitch` multiplies frequencies, `dull:true` = lowpass ~3 kHz (cardboard hero kit). Clamp t to ≥ currentTime. No-op returning [] if not init'd.
- `click(t, accent, vol=0.4)` metronome tick (accent = higher pitch)
- `bass(t, semitone, rootHz, dur)` short triangle bass note
- `blip(freq)` tiny square blip for speech-bubble "voice"
- `bwomp()` hero-hurt descending saw · `zap()` projectile-hits-boss · `cheer()` happy arpeggio (boss defeated) · `boo()` sad trombone-ish (hero lost) · `fanfare()` big champion jingle
All one-shots play "now". Never throw.

## art.js — pure drawing, no game state
Exports:
- `OUT` = '#1d1433' outline color; helpers `circle, ell, rrect, poly, line, text(ctx,s,x,y,size,fill,opts)` (text = Bangers font with thick OUT stroke; opts: align, base, lw, stroke, font).
- `KIT = {kick:[0,-62], snare:[96,-116], hihat:[-104,-170], tom:[40,-156]}` local offsets from a character's feet (x mirrored by m).
- `kitPoint(x, y, m, s, drum)` → world [px,py] of that drum for a character at feet (x,y), facing m (hero m=1, boss m=-1), scale s.
- `BOSS_ART[key]` for key in raccoon|octopus|robot|volcano: `{ s: scale, head:[hx,hy] /*local head point, for bubble tails/projectile targets*/ }` (plus whatever internal fields).
- `drawHero(ctx, x, y, anim, t, beats, s=1)`
- `drawBoss(ctx, key, x, y, anim, t, beats, s=1)`
- `drawBg(ctx, stage, t, beats)` stage ∈ garage|alley|disco|lab|volcano; fills full 1280x720; floor line at y≈560–600, characters stand at y=600.
- `drawBursts(ctx, x, y, m, s, anim)` comic "BOOM!/CRACK!/TSS!/BONG!" star bursts at drums with anim > 0.45.

`anim` = `{hihat,kick,snare,tom,hurt,ko,talk}` each 0..1 (drum values = 1 at the moment of a hit, decaying). `t` = seconds (UI time), `beats` = continuous beat count (float; fractional part = beat phase; bob on beat, robot pendulum swings once per beat).
Characters: thick outlines, bright cartoon colors, goofy faces. Each char draws body → its own drum kit (KIT positions; hero kit is cardboard boxes, boss kits themed) → arms holding drumsticks that swing down to whichever drum was just hit (hihat arm on one side, snare/tom arm on the other; kick = body bob + drum jiggle). hurt → jitter + pained face; ko → X eyes, topples, stars orbit head; talk → mouth flaps.
Robot: tall metronome body with LED face and swinging pendulum. Volcano: big cone with angry face, lava, smoke. Octopus: purple dome head, shades, waving tentacles, gold chain. Raccoon: grumpy, mask, striped tail, banana peel on head.

## game.js — engine, scenes, HUD (imports the three modules above)
Scenes: title → intro (boss card + ladder) → battle → victory/defeat → … → champion.
Timing uses `sound.now` (audio clock). Battle timeline: bar 0 = count-in, round k call bar at start+(1+2k)*bar, response bar right after. Schedule boss notes with Web Audio ahead of time; metronome/bass via lookahead scheduler. Judge windows PERFECT ±0.075 s, GOOD ±0.16 s against `sound.now - sound.latency()`; wrong drum within window consumes the note; unhit notes past window = miss. Pattern difficulty scales with boss damage taken (see bosses.js fields).
