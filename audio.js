/* =========================================================
   MOTOR DE MÚSICA — CHIPTUNE SYNTHWAVE (Web Audio API)
   Genera la música de forma procedural (osciladores), así que
   no depende de ningún archivo de audio externo. Cada pista es
   una composición original propia del proyecto, con un estilo
   distinto acorde al tema de cada pantalla/modo:
     - menu:     ambiente synthwave relajado
     - arcade:   chiptune enérgico y alegre
     - bossrush: tenso, oscuro, en modo frigio
     - vs:       rápido y competitivo
   ========================================================= */

const MusicEngine = (() => {
    let audioCtx = null;
    let masterGain = null;

    let currentTrackName = null;
    let schedulerTimer = null;
    let nextNoteTime = 0;
    let stepIndex = 0;

    let muted = false;
    let volume = 0.45;

    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD_S = 0.15;

    const NOTE_INDEX = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };

    function noteFreq(note) {
        if (!note) return null;
        const match = /^([A-G]#?)(\d)$/.exec(note);
        if (!match) return null;
        const semitoneFromA4 = NOTE_INDEX[match[1]] + (parseInt(match[2], 10) - 4) * 12;
        return 440 * Math.pow(2, semitoneFromA4 / 12);
    }

    // ---------- COMPOSICIONES (originales, 8 corcheas x 4 compases = 32 pasos) ----------
    const TRACKS = {
        menu: {
            tempo: 82, stepBeats: 0.5,
            leadWave: 'triangle', bassWave: 'sine',
            leadGain: 0.05, bassGain: 0.06,
            lead: ['A4', null, 'C5', null, 'E5', null, 'A5', null, 'G4', null, 'B4', null, 'D5', null, 'G5', null,
                   'F4', null, 'A4', null, 'C5', null, 'F5', null, 'E4', null, 'G4', null, 'B4', null, 'E5', null],
            bass: ['A2', null, null, null, null, null, null, null, 'G2', null, null, null, null, null, null, null,
                   'F2', null, null, null, null, null, null, null, 'E2', null, null, null, null, null, null, null]
        },
        arcade: {
            tempo: 132, stepBeats: 0.5,
            leadWave: 'square', bassWave: 'triangle',
            leadGain: 0.07, bassGain: 0.08,
            lead: ['A4', 'C5', 'E4', 'C5', 'A4', 'G4', 'F4', 'E4', 'F4', 'A4', 'C5', 'A4', 'G4', 'E4', 'D4', 'C4',
                   'A4', 'C5', 'E4', 'C5', 'B4', 'G4', 'F4', 'E4', 'F4', 'A4', 'C5', 'B4', 'A4', 'E4', 'D4', 'A3'],
            bass: ['A2', null, null, null, 'E2', null, null, null, 'F2', null, null, null, 'C3', null, null, null,
                   'A2', null, null, null, 'E2', null, null, null, 'F2', null, null, null, 'G2', null, null, null]
        },
        bossrush: {
            tempo: 150, stepBeats: 0.5,
            leadWave: 'sawtooth', bassWave: 'square',
            leadGain: 0.06, bassGain: 0.09,
            lead: ['D5', 'C5', 'A#4', 'A4', 'G4', 'F4', 'D#4', 'D4', 'D5', 'C5', 'A#4', 'A4', 'G4', 'A4', 'A#4', 'C5',
                   'D5', 'C5', 'A#4', 'A4', 'G4', 'F4', 'D#4', 'D4', 'A4', 'A#4', 'C5', 'D5', 'D#5', 'D5', 'C5', 'A#4'],
            bass: ['D2', 'D2', 'D2', 'D2', 'A1', 'A1', 'D2', 'D2', 'D2', 'D2', 'D2', 'D2', 'A1', 'A1', 'D2', 'D2',
                   'D2', 'D2', 'D2', 'D2', 'A1', 'A1', 'D2', 'D2', 'G1', 'G1', 'G1', 'G1', 'A1', 'A1', 'D2', 'D2']
        },
        vs: {
            tempo: 160, stepBeats: 0.5,
            leadWave: 'square', bassWave: 'sawtooth',
            leadGain: 0.07, bassGain: 0.07,
            lead: ['C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'E4', 'G4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C4', 'A3', 'C4',
                   'D5', 'F5', 'A5', 'F5', 'D5', 'A4', 'F4', 'A4', 'G4', 'B4', 'D5', 'B4', 'G4', 'D4', 'B3', 'D4'],
            bass: ['C3', 'C2', 'C3', 'C2', 'G2', 'G2', 'G2', 'G2', 'F2', 'F1', 'F2', 'F1', 'C2', 'C2', 'C2', 'C2',
                   'D3', 'D2', 'D3', 'D2', 'A2', 'A2', 'A2', 'A2', 'G2', 'G1', 'G2', 'G1', 'D2', 'D2', 'D2', 'D2']
        }
    };

    function ensureContext() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            audioCtx = new AC();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = muted ? 0 : volume;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playTone(freq, startTime, duration, waveType, gainValue) {
        if (!freq || !audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.9);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    function scheduler() {
        const track = TRACKS[currentTrackName];
        if (!track || !audioCtx) return;
        const secPerStep = (60 / track.tempo) * track.stepBeats;

        while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_S) {
            const i = stepIndex % track.lead.length;
            const leadNote = track.lead[i];
            const bassNote = track.bass[i];

            if (leadNote) playTone(noteFreq(leadNote), nextNoteTime, secPerStep * 0.95, track.leadWave, track.leadGain);
            if (bassNote) playTone(noteFreq(bassNote), nextNoteTime, secPerStep * 0.95, track.bassWave, track.bassGain);

            nextNoteTime += secPerStep;
            stepIndex++;
        }
        schedulerTimer = setTimeout(scheduler, LOOKAHEAD_MS);
    }

    function playTrack(name) {
        if (!TRACKS[name]) return;
        ensureContext();
        if (!audioCtx) return;
        if (currentTrackName === name && schedulerTimer) return;

        stop();
        currentTrackName = name;
        stepIndex = 0;
        nextNoteTime = audioCtx.currentTime + 0.05;
        scheduler();
    }

    function stop() {
        if (schedulerTimer) clearTimeout(schedulerTimer);
        schedulerTimer = null;
        currentTrackName = null;
    }

    // Pequeño arpegio descendente de una sola vez para "Game Over"
    function playGameOverJingle() {
        ensureContext();
        if (!audioCtx) return;
        const notes = ['A4', 'F4', 'D4', 'A3', 'D3'];
        let t = audioCtx.currentTime + 0.05;
        notes.forEach((n, idx) => {
            playTone(noteFreq(n), t, 0.28, 'square', 0.08);
            t += idx === notes.length - 2 ? 0.16 : 0.13;
        });
    }

    function setMuted(value) {
        muted = value;
        if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, audioCtx.currentTime, 0.05);
        localStorage.setItem('tetris_music_muted', muted ? '1' : '0');
    }

    function setVolume(value) {
        volume = Math.max(0, Math.min(1, value));
        if (masterGain && !muted) masterGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.05);
        localStorage.setItem('tetris_music_volume', String(volume));
    }

    function isMuted() { return muted; }
    function getVolume() { return volume; }

    function loadPrefs() {
        const storedMuted = localStorage.getItem('tetris_music_muted');
        const storedVolume = localStorage.getItem('tetris_music_volume');
        muted = storedMuted === '1';
        volume = storedVolume !== null ? parseFloat(storedVolume) : 0.45;
    }

    loadPrefs();

    return { playTrack, stop, playGameOverJingle, setMuted, setVolume, isMuted, getVolume, ensureContext };
})();
