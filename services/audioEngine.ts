import { SynthConfig, Waveform } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private config: SynthConfig;

  constructor(initialConfig: SynthConfig) {
    this.config = initialConfig;
  }

  public async init() {
    if (this.ctx) return;
    
    // Low latency hint is critical for real-time instruments
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
    
    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6;

    // Compressor (Essential for polyphony to prevent clipping)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.002; 
    this.compressor.release.value = 0.25;

    // Effects Bus (Simple Delay)
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.3;
    
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = this.config.delayMix;

    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.4;
    
    // Routing
    this.masterGain.connect(this.compressor);
    this.masterGain.connect(this.delayNode);
    
    this.delayNode.connect(feedback);
    feedback.connect(this.delayNode);
    
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.compressor);
    
    this.compressor.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public updateConfig(newConfig: SynthConfig) {
    this.config = newConfig;
    if (this.delayGain && this.ctx) {
      this.delayGain.gain.setTargetAtTime(newConfig.delayMix, this.ctx.currentTime, 0.1);
    }
  }

  private noteToFreq(note: string): number {
    const noteMap: { [key: string]: number } = {
      "C0": 16.35, "C#0": 17.32, "Db0": 17.32, "D0": 18.35, "D#0": 19.45, "Eb0": 19.45, "E0": 20.60, "F0": 21.83, "F#0": 23.12, "Gb0": 23.12, "G0": 24.50, "G#0": 25.96, "Ab0": 25.96, "A0": 27.50, "A#0": 29.14, "Bb0": 29.14, "B0": 30.87,
      "C1": 32.70, "C#1": 34.65, "Db1": 34.65, "D1": 36.71, "D#1": 38.89, "Eb1": 38.89, "E1": 41.20, "F1": 43.65, "F#1": 46.25, "Gb1": 46.25, "G1": 49.00, "G#1": 51.91, "Ab1": 51.91, "A1": 55.00, "A#1": 58.27, "Bb1": 58.27, "B1": 61.74,
      "C2": 65.41, "C#2": 69.30, "Db2": 69.30, "D2": 73.42, "D#2": 77.78, "Eb2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "Gb2": 92.50, "G2": 98.00, "G#2": 103.83, "Ab2": 103.83, "A2": 110.00, "A#2": 116.54, "Bb2": 116.54, "B2": 123.47,
      "C3": 130.81, "C#3": 138.59, "Db3": 138.59, "D3": 146.83, "D#3": 155.56, "Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "Gb3": 185.00, "G3": 196.00, "G#3": 207.65, "Ab3": 207.65, "A3": 220.00, "A#3": 233.08, "Bb3": 233.08, "B3": 246.94,
      "C4": 261.63, "C#4": 277.18, "Db4": 277.18, "D4": 293.66, "D#4": 311.13, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "Gb4": 369.99, "G4": 392.00, "G#4": 415.30, "Ab4": 415.30, "A4": 440.00, "A#4": 466.16, "Bb4": 466.16, "B4": 493.88,
      "C5": 523.25, "C#5": 554.37, "Db5": 554.37, "D5": 587.33, "D#5": 622.25, "Eb5": 622.25, "E5": 659.26, "F5": 698.46, "F#5": 739.99, "Gb5": 739.99, "G5": 783.99, "G#5": 830.61, "Ab5": 830.61, "A5": 880.00, "A#5": 932.33, "Bb5": 932.33, "B5": 987.77,
      "C6": 1046.50, "C#6": 1108.73, "Db6": 1108.73, "D6": 1174.66, "D#6": 1244.51, "Eb6": 1244.51, "E6": 1318.51, "F6": 1396.91, "F#6": 1479.98, "Gb6": 1479.98, "G6": 1567.98, "G#6": 1661.22, "Ab6": 1661.22, "A6": 1760.00, "A#6": 1864.66, "Bb6": 1864.66, "B6": 1975.53
    };
    return noteMap[note] || 440;
  }

  public playNote(note: string) {
    if (!this.ctx || !this.masterGain) return;

    // Ensure context is running
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.error);
    }

    const freq = this.noteToFreq(note);
    const t = this.ctx.currentTime;
    
    // Oscillator 1
    const osc = this.ctx.createOscillator();
    osc.type = this.config.waveform;
    osc.frequency.setValueAtTime(freq, t);

    // Detune logic (simulating richer sound)
    if (this.config.detune) {
      osc.detune.setValueAtTime(this.config.detune, t);
    }

    // Optional Sub-Oscillator or Dual Oscillator logic could go here for even thicker sound
    // For now, we stick to one main osc per note + detune which already adds character

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.config.filterFreq, t);
    filter.Q.value = 5;

    // Envelope
    gain.gain.setValueAtTime(0, t);
    
    // Immediate attack for low latency feel
    if (this.config.attack < 0.005) {
        gain.gain.setValueAtTime(this.config.gain, t);
    } else {
        gain.gain.linearRampToValueAtTime(this.config.gain, t + this.config.attack);
    }
    
    gain.gain.exponentialRampToValueAtTime(this.config.gain * this.config.sustain + 0.001, t + this.config.attack + this.config.decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + this.config.attack + this.config.decay + this.config.release);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    const stopTime = t + this.config.attack + this.config.decay + this.config.release + 0.1;
    osc.stop(stopTime);
    
    // Precise cleanup
    osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
    };
  }
}

export default AudioEngine;