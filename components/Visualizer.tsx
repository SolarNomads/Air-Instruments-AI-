import React, { forwardRef } from 'react';

interface VisualizerProps {
  width: number;
  height: number;
}

// Visualizer is now just a dumb container to accept the Ref.
// All drawing logic happens in the main game loop in App.tsx to avoid React Render Cycle latency.
const Visualizer = forwardRef<HTMLCanvasElement, VisualizerProps>(({ width, height }, ref) => {
  return (
    <canvas 
      ref={ref} 
      width={width} 
      height={height} 
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
});

Visualizer.displayName = 'Visualizer';

export default Visualizer;