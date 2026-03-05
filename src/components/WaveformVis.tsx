import React, { useEffect, useRef } from 'react';
import { globalAnalyser } from '../services/audioEngine';

export const WaveformVis: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let raf: number;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const values = globalAnalyser.getValue() as Float32Array;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.beginPath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff4a00'; 
      
      const sliceWidth = canvas.width / values.length;
      let x = 0;
      
      for (let i = 0; i < values.length; i++) {
        const v = values[i] * 0.5; 
        const y = (v + 0.5) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff4a0055';
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width="800" height="300" className="w-full h-full object-cover opacity-90" />;
};
