import { useEffect, useRef, useState } from 'react';
import { getSoundEnabled } from '../utils/audio';

// Singleton audio context to comply with browser policies
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function useCinematicAudio() {
  const soundOn = getSoundEnabled();
  const humOscRef = useRef(null);
  const humGainRef = useRef(null);
  
  // 1. Setup the ambient hum (plays continuously when sound is on)
  useEffect(() => {
    if (!soundOn) {
      if (humGainRef.current) {
        humGainRef.current.gain.setTargetAtTime(0, audioCtx?.currentTime || 0, 0.1);
      }
      return;
    }

    const ctx = getAudioContext();
    
    // Create oscillator and gain node if they don't exist
    if (!humOscRef.current) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Deep cinematic drone setup
      osc.type = 'sine';
      osc.frequency.value = 55; // Low bass frequency (A1)
      
      // Filter out high frequencies for a muffled rumble
      filter.type = 'lowpass';
      filter.frequency.value = 150;

      // Start silent
      gainNode.gain.value = 0;

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      
      humOscRef.current = osc;
      humGainRef.current = gainNode;
    }

    // Fade in
    humGainRef.current.gain.setTargetAtTime(0.3, ctx.currentTime, 1.0);

    return () => {
      // Fade out on cleanup/sound off, but don't disconnect so we can reuse
      if (humGainRef.current) {
        humGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      }
    };
  }, [soundOn]);

  // Modulate the hum based on scroll velocity (called from rAF/useFrame)
  const modulateHum = (normalizedVelocity) => {
    if (!soundOn || !humOscRef.current || !humGainRef.current) return;
    const ctx = getAudioContext();
    // Pitch shift slightly up based on speed
    const baseFreq = 55;
    const targetFreq = baseFreq + (Math.abs(normalizedVelocity) * 20);
    humOscRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
    
    // Volume swells on speed
    const baseGain = 0.3;
    const targetGain = baseGain + (Math.abs(normalizedVelocity) * 0.4);
    humGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
  };

  // 2. Synthesize a glass shatter/chime sound
  const playShatter = () => {
    if (!soundOn) return;
    const ctx = getAudioContext();
    
    // Create multiple high-frequency oscillators for a metallic/glassy sound
    const freqs = [1200, 2400, 3600, 4800, 7200];
    
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Use triangle waves for a harsher, bell-like timbre
      osc.type = 'triangle';
      
      // Slight detuning for dissonance
      osc.frequency.value = freq + (Math.random() * 50);
      
      // Envelope: instant attack, exponential decay
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      // Stagger the hits slightly for a shattering effect
      const startTime = ctx.currentTime + (Math.random() * 0.05);
      gainNode.gain.setValueAtTime(0.15 / (index + 1), startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8 + (Math.random() * 0.5));
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 2);
    });
  };

  return { playShatter, modulateHum };
}
