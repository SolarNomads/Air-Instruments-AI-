import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import AudioEngine from './services/audioEngine';
import Visualizer from './components/Visualizer';
import { InstrumentState, INSTRUMENT_PRESETS } from './types';

// Constants
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const NUM_STRINGS = 12;

function App() {
  // State
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(INSTRUMENT_PRESETS[0].id);
  const [instrument, setInstrument] = useState<InstrumentState>(INSTRUMENT_PRESETS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Refs for logic loop
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  
  // Physics State Refs (Mutable for speed)
  const lastFingerData = useRef<Map<number, { x: number, time: number }>>(new Map());
  const activeStringsRef = useRef<number[]>(new Array(NUM_STRINGS).fill(0)); 
  const stringDebounceRef = useRef<number[]>(new Array(NUM_STRINGS).fill(0));

  // 1. Initialize Audio Engine
  useEffect(() => {
    const engine = new AudioEngine(instrument.config);
    setAudioEngine(engine);
  }, []);

  // Update engine when instrument changes
  useEffect(() => {
    if (audioEngine) {
      audioEngine.updateConfig(instrument.config);
    }
  }, [instrument, audioEngine]);

  // 2. Initialize MediaPipe
  useEffect(() => {
    const initVision = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        handLandmarkerRef.current = landmarker;
        setLoading(false);
      } catch (e) {
        console.error("Failed to load MediaPipe:", e);
        setErrorMsg("Failed to load computer vision capabilities. Please refresh.");
      }
    };
    initVision();
  }, []);

  // 3. Start Camera & Game Loop
  const startCamera = async () => {
    if (!videoRef.current || !audioEngine) return;
    
    try {
      await audioEngine.init();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: VIDEO_WIDTH }, 
          height: { ideal: VIDEO_HEIGHT },
          frameRate: { ideal: 60 }
        }
      });
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadeddata = () => {
        videoRef.current?.play();
        setIsPlaying(true);
        if ('requestVideoFrameCallback' in videoRef.current!) {
           (videoRef.current as any).requestVideoFrameCallback(gameLoop);
        } else {
           requestAnimationFrame(gameLoop);
        }
      };
    } catch (e) {
      console.error("Camera Error:", e);
      setErrorMsg("Camera access denied or unavailable.");
    }
  };

  // 4. The "Game Loop"
  const gameLoop = (now: number, metadata?: any) => {
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    
    if (!video || !landmarker || video.paused || video.ended) return;

    const frameTime = metadata?.presentationTime || now;

    // A. Vision Prediction
    let result = null;
    try {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        result = landmarker.detectForVideo(video, now);
      }
    } catch (e) { console.warn(e); }

    // B. Physics Step
    if (result && result.landmarks) {
      processPhysics(result.landmarks, frameTime);
    }

    // C. Render Step
    drawFrame(result ? result.landmarks : [], now);

    // D. Schedule Next Frame
    if ('requestVideoFrameCallback' in video) {
      (video as any).requestVideoFrameCallback(gameLoop);
    } else {
      requestRef.current = requestAnimationFrame((t) => gameLoop(t));
    }
  };

  const isFingerOpen = (landmarks: any[], tipIdx: number, pipIdx: number, wristIdx: number) => {
      // Geometric Check:
      // If the distance from Wrist(0) to Tip(8) is LESS than distance from Wrist(0) to PIP(6),
      // the finger is curled inward.
      const wrist = landmarks[wristIdx];
      const pip = landmarks[pipIdx];
      const tip = landmarks[tipIdx];

      const distWristToPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
      const distWristToTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);

      // We add a small tolerance factor (1.1) to be generous with "open" detection
      // If tip is significantly closer than pip, it's closed.
      return distWristToTip > (distWristToPip * 0.9);
  };

  const processPhysics = (landmarksArray: any[], now: number) => {
    if (!audioEngine) return;

    const stringSpacing = 1.0 / (NUM_STRINGS + 1);
    
    // Physics Constants
    const velocityThreshold = 0.00015; // Normalized units per ms
    const debounceTime = 40; // ms

    landmarksArray.forEach((landmarks, handIndex) => {
      // Finger Mapping: Tip Index -> PIP Index (Knuckle 2)
      // Index: 8 -> 6
      // Middle: 12 -> 10
      // Ring: 16 -> 14
      // Pinky: 20 -> 18
      const fingers = [
        { tip: 8, pip: 6 },
        { tip: 12, pip: 10 },
        { tip: 16, pip: 14 },
        { tip: 20, pip: 18 }
      ];

      fingers.forEach(({ tip, pip }) => {
        // 1. Check if finger is OPEN
        if (!isFingerOpen(landmarks, tip, pip, 0)) {
           // If closed, update position but don't trigger
           // We still need to update tracking to avoid giant velocity jumps when opening
           const rawX = landmarks[tip].x;
           const x = 1.0 - rawX; 
           const fingerId = handIndex * 100 + tip;
           lastFingerData.current.set(fingerId, { x, time: now });
           return;
        }

        // Mirror X
        const rawX = landmarks[tip].x;
        const x = 1.0 - rawX; 
        const y = landmarks[tip].y;
        
        const fingerId = handIndex * 100 + tip;
        const lastData = lastFingerData.current.get(fingerId);

        if (lastData) {
          const dx = x - lastData.x;
          const dt = now - lastData.time;
          const velocity = dt > 0 ? Math.abs(dx) / dt : 0;
          
          if (velocity > velocityThreshold) {
            for (let s = 0; s < NUM_STRINGS; s++) {
              const stringX = stringSpacing * (s + 1);
              
              const lastX = lastData.x;
              const crossedLeftToRight = lastX < stringX && x >= stringX;
              const crossedRightToLeft = lastX > stringX && x <= stringX;

              if (crossedLeftToRight || crossedRightToLeft) {
                // Y-Zone check
                if (y > 0.1 && y < 0.9) {
                  if (now - stringDebounceRef.current[s] > debounceTime) {
                    triggerString(s, now);
                    stringDebounceRef.current[s] = now;
                  }
                }
              }
            }
          }
        }
        
        lastFingerData.current.set(fingerId, { x, time: now });
      });
    });
  };

  const triggerString = (index: number, now: number) => {
    if (!audioEngine) return;
    
    const note = instrument.notes[index % instrument.notes.length];
    audioEngine.playNote(note);
    activeStringsRef.current[index] = performance.now(); 
  };

  const drawFrame = (handLandmarks: any[], now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    // 1. Clear
    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    // 2. Draw Strings
    const stringSpacing = VIDEO_WIDTH / (NUM_STRINGS + 1);
    const renderNow = performance.now();
    
    // Get current instrument color or default
    const baseColor = instrument.color === 'cyan' ? '34, 211, 238' :
                      instrument.color === 'rose' ? '251, 113, 133' :
                      instrument.color === 'yellow' ? '250, 204, 21' :
                      instrument.color === 'orange' ? '251, 146, 60' :
                      instrument.color === 'purple' ? '192, 132, 252' :
                      instrument.color === 'blue' ? '96, 165, 250' :
                      instrument.color === 'emerald' ? '52, 211, 153' :
                      instrument.color === 'lime' ? '163, 230, 53' :
                      instrument.color === 'amber' ? '251, 191, 36' :
                      '232, 121, 249'; // fuchsia

    for (let i = 0; i < NUM_STRINGS; i++) {
      const x = stringSpacing * (i + 1);
      
      const lastTrigger = activeStringsRef.current[i];
      const timeSinceTrigger = renderNow - lastTrigger;
      let intensity = 0;
      
      if (timeSinceTrigger < 300) {
        intensity = 1 - (timeSinceTrigger / 300);
        intensity = Math.pow(intensity, 2);
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIDEO_HEIGHT);
      
      if (intensity > 0.01) {
        ctx.strokeStyle = `rgba(${baseColor}, ${0.4 + (intensity * 0.6)})`;
        ctx.lineWidth = 3 + (intensity * 6);
        ctx.shadowBlur = 15 + (intensity * 20);
        ctx.shadowColor = `rgb(${baseColor})`;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();

      if (intensity > 0.01) {
        ctx.beginPath();
        ctx.arc(x, VIDEO_HEIGHT/2, 10 + (intensity * 50), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${intensity * 0.2})`;
        ctx.fill();
      }
    }
    
    // 3. Draw Hands
    ctx.shadowBlur = 0;
    
    handLandmarks.forEach((landmarks) => {
      const drawPoint = (index: number) => {
        const p = landmarks[index];
        return { x: (1 - p.x) * VIDEO_WIDTH, y: p.y * VIDEO_HEIGHT };
      };

      // Connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], 
        [0, 5], [5, 6], [6, 7], [7, 8], 
        [0, 9], [9, 10], [10, 11], [11, 12], 
        [0, 13], [13, 14], [14, 15], [15, 16], 
        [0, 17], [17, 18], [18, 19], [19, 20]
      ];

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(161, 161, 170, 0.6)';
      
      connections.forEach(([start, end]) => {
        const p1 = drawPoint(start);
        const p2 = drawPoint(end);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Visualize Open/Closed State for fingertips
      // Tip (8) vs Pip (6), etc
      const fingers = [
        { tip: 8, pip: 6 }, { tip: 12, pip: 10 }, { tip: 16, pip: 14 }, { tip: 20, pip: 18 }
      ];

      fingers.forEach(({ tip, pip }) => {
        const p = drawPoint(tip);
        const isOpen = isFingerOpen(landmarks, tip, pip, 0);

        ctx.beginPath();
        ctx.arc(p.x, p.y, isOpen ? 8 : 4, 0, Math.PI * 2);
        
        if (isOpen) {
           ctx.fillStyle = '#4ade80'; // Green for active
           ctx.shadowColor = '#4ade80';
           ctx.shadowBlur = 15;
        } else {
           ctx.fillStyle = '#ef4444'; // Red for closed/inactive
           ctx.shadowBlur = 0;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    });
  };

  const handleSelectPreset = (preset: InstrumentState) => {
    setSelectedPresetId(preset.id);
    setInstrument(preset);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans text-gray-100">
      
      {/* Background UI */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
         <div className="absolute top-10 left-10 w-64 h-32 border border-zinc-700 rounded p-2 text-xs text-zinc-500 font-mono hidden md:block">
            ACTIVE_PRESET: {instrument.id.toUpperCase()}<br/>
            WAVEFORM: {instrument.config.waveform.toUpperCase()}<br/>
            FILTER_FREQ: {instrument.config.filterFreq}Hz
         </div>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full max-w-6xl aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-zinc-900 text-cyan-500 space-y-4">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-mono text-sm tracking-wider">INITIALIZING VISION...</p>
          </div>
        )}

        {!isPlaying && !loading && (
           <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-sm">
               <button 
                onClick={startCamera}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xl px-12 py-4 rounded-full font-bold transition-all shadow-lg shadow-cyan-500/20 tracking-widest scale-110 hover:scale-125"
               >
                 ENTER
               </button>
           </div>
        )}

        {errorMsg && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/90 text-red-500 p-8 text-center">
            {errorMsg}
          </div>
        )}

        {/* Video Feed */}
        <video 
          ref={videoRef}
          className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 opacity-60"
          playsInline
          muted
        />

        {/* Overlay Canvas */}
        <Visualizer 
          ref={canvasRef}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        
        {/* Preset Selector HUD */}
        <div className={`absolute top-4 right-4 z-30 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-[calc(100%-40px)]'} flex`}>
           <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="h-10 w-10 bg-zinc-800 rounded-l flex items-center justify-center hover:bg-zinc-700 text-white border-l border-y border-zinc-700"
           >
             {isSidebarOpen ? '→' : '♫'}
           </button>
           <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 p-4 rounded-bl-xl shadow-2xl w-64 max-h-[80vh] overflow-y-auto">
              <h3 className="text-sm font-bold text-zinc-400 mb-3 tracking-wider">SOUND BANK</h3>
              <div className="space-y-2">
                {INSTRUMENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-all border-l-2 ${
                      selectedPresetId === preset.id 
                      ? `bg-zinc-800 border-cyan-500 text-cyan-400` 
                      : `hover:bg-zinc-800 border-transparent text-zinc-400 hover:text-zinc-200`
                    }`}
                  >
                    <div className="font-bold">{preset.name}</div>
                    <div className="opacity-50 text-[10px]">{preset.description}</div>
                  </button>
                ))}
              </div>
           </div>
        </div>
        
        {/* Bottom String Labels */}
        <div className="absolute bottom-0 w-full h-full pointer-events-none flex justify-between px-[4%] pb-2 items-end opacity-60">
            {instrument.notes.map((note, i) => (
                <div key={i} className="flex flex-col items-center justify-end w-full h-full border-b border-transparent">
                  <span className="text-[10px] font-mono text-zinc-400">
                    {note}
                  </span>
                </div>
            ))}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-4 text-zinc-500 text-xs text-center max-w-lg font-mono">
        Open fingers to play. Close hand to silence. Move fast to pluck.
      </div>

    </div>
  );
}

export default App;