export enum Waveform {
  SINE = 'sine',
  SQUARE = 'square',
  SAWTOOTH = 'sawtooth',
  TRIANGLE = 'triangle'
}

export interface SynthConfig {
  waveform: Waveform;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gain: number;
  filterFreq: number;
  delayMix: number; // 0 to 1
  detune?: number; // cents
}

export interface InstrumentState {
  id: string;
  name: string;
  notes: string[]; // Array of frequencies or note names
  config: SynthConfig;
  description: string;
  color: string;
}

// Default Scale (Pentatonic C Major)
export const SCALE_PENTATONIC_C = [
  "C4", "D4", "E4", "G4", "A4",
  "C5", "D5", "E5", "G5", "A5",
  "C6", "D6"
];

export const SCALE_MINOR = [
  "C4", "Eb4", "F4", "G4", "Bb4",
  "C5", "Eb5", "F5", "G5", "Bb5",
  "C6", "Eb6"
];

export const SCALE_CHROMATIC = [
  "C4", "Db4", "D4", "Eb4", "E4", "F4", "Gb4", "G4", "Ab4", "A4", "Bb4", "B4"
];

export const DEFAULT_NOTES = SCALE_PENTATONIC_C;

export const DEFAULT_CONFIG: SynthConfig = {
  waveform: Waveform.SINE,
  attack: 0.005,
  decay: 0.1,
  sustain: 0.3,
  release: 1.5,
  gain: 0.3,
  filterFreq: 2000,
  delayMix: 0.3
};

// 10 Distinct Presets
export const INSTRUMENT_PRESETS: InstrumentState[] = [
  {
    id: "harp",
    name: "Ethereal Harp",
    notes: SCALE_PENTATONIC_C,
    color: "cyan",
    description: "Pure sine waves with a touch of delay.",
    config: {
      waveform: Waveform.SINE,
      attack: 0.005,
      decay: 0.1,
      sustain: 0.3,
      release: 1.5,
      gain: 0.3,
      filterFreq: 2000,
      delayMix: 0.3
    }
  },
  {
    id: "bass",
    name: "Cyber Bass",
    notes: ["C2", "D2", "E2", "G2", "A2", "C3", "D3", "E3", "G3", "A3", "C4", "D4"],
    color: "rose",
    description: "Deep, aggressive sawtooth bass.",
    config: {
      waveform: Waveform.SAWTOOTH,
      attack: 0.01,
      decay: 0.2,
      sustain: 0.8,
      release: 0.4,
      gain: 0.25,
      filterFreq: 400,
      delayMix: 0.0,
      detune: 10
    }
  },
  {
    id: "8bit",
    name: "8-Bit Arcade",
    notes: SCALE_PENTATONIC_C,
    color: "yellow",
    description: "Retro square waves.",
    config: {
      waveform: Waveform.SQUARE,
      attack: 0.001,
      decay: 0.1,
      sustain: 0.1,
      release: 0.1,
      gain: 0.15,
      filterFreq: 8000,
      delayMix: 0.0
    }
  },
  {
    id: "koto",
    name: "Japanese Koto",
    notes: ["C4", "Db4", "F4", "G4", "Bb4", "C5", "Db5", "F5", "G5", "Bb5", "C6", "Db6"],
    color: "orange",
    description: "Plucked string instrument sound.",
    config: {
      waveform: Waveform.TRIANGLE,
      attack: 0.0,
      decay: 0.2,
      sustain: 0.0,
      release: 0.4,
      gain: 0.4,
      filterFreq: 3000,
      delayMix: 0.1
    }
  },
  {
    id: "pad",
    name: "Space Pad",
    notes: SCALE_MINOR,
    color: "purple",
    description: "Slow attack, heavy reverb/delay.",
    config: {
      waveform: Waveform.TRIANGLE,
      attack: 0.8,
      decay: 0.5,
      sustain: 0.8,
      release: 2.0,
      gain: 0.3,
      filterFreq: 800,
      delayMix: 0.6,
      detune: 5
    }
  },
  {
    id: "lead",
    name: "Trance Lead",
    notes: SCALE_MINOR,
    color: "blue",
    description: "Bright super-saw anthem sound.",
    config: {
      waveform: Waveform.SAWTOOTH,
      attack: 0.01,
      decay: 0.3,
      sustain: 0.6,
      release: 0.5,
      gain: 0.15,
      filterFreq: 5000,
      delayMix: 0.4,
      detune: 15
    }
  },
  {
    id: "marimba",
    name: "Glass Marimba",
    notes: SCALE_PENTATONIC_C,
    color: "emerald",
    description: "Woody, percussive sine tone.",
    config: {
      waveform: Waveform.SINE,
      attack: 0.001,
      decay: 0.05,
      sustain: 0.0,
      release: 0.1,
      gain: 0.5,
      filterFreq: 3000,
      delayMix: 0.0
    }
  },
  {
    id: "scifi",
    name: "Sci-Fi Zap",
    notes: SCALE_CHROMATIC,
    color: "lime",
    description: "High resonance filter zaps.",
    config: {
      waveform: Waveform.SAWTOOTH,
      attack: 0.001,
      decay: 0.1,
      sustain: 0.0,
      release: 0.2,
      gain: 0.2,
      filterFreq: 1500,
      delayMix: 0.2,
      detune: 50
    }
  },
  {
    id: "organ",
    name: "Church Organ",
    notes: SCALE_MINOR,
    color: "amber",
    description: "Full, sustained tone.",
    config: {
      waveform: Waveform.TRIANGLE,
      attack: 0.1,
      decay: 0.1,
      sustain: 1.0,
      release: 0.8,
      gain: 0.3,
      filterFreq: 1200,
      delayMix: 0.3,
      detune: 4
    }
  },
  {
    id: "glitch",
    name: "Noise Glitch",
    notes: SCALE_CHROMATIC,
    color: "fuchsia",
    description: "Detuned, aggressive texture.",
    config: {
      waveform: Waveform.SQUARE,
      attack: 0.01,
      decay: 0.1,
      sustain: 0.4,
      release: 0.1,
      gain: 0.1,
      filterFreq: 8000,
      delayMix: 0.1,
      detune: 100
    }
  }
];