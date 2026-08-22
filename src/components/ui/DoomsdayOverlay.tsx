import { useState } from 'react';
import { ShieldAlert, Zap, ArrowRight, X } from 'lucide-react';
import Lightning from '../animation/Lightning';

interface DoomsdayOverlayProps {
  onDismiss?: () => void;
}

export default function DoomsdayOverlay({ onDismiss }: DoomsdayOverlayProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleEnter = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden bg-black text-white select-none"
      style={{
        fontFamily: "'Orbitron', 'Montserrat', 'Syne', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Non-stop WebGL Electric Green Lightning Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-90">
        <Lightning hue={122} speed={1.2} intensity={1.7} size={1} />
      </div>

      {/* Cyber Grid & Ambient Dark Glow Overlay */}
      <div
        className="absolute inset-0 z-1 pointer-events-none opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 197, 94, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute inset-0 z-1 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />

      {/* Top Protocol Status Indicator */}
      <div className="absolute top-8 left-8 right-8 z-10 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono tracking-widest text-emerald-400 font-bold uppercase">
            PROTOCOL: DOOMSDAY ACTIVE
          </span>
        </div>

        <button
          onClick={handleEnter}
          className="text-xs font-mono uppercase tracking-wider text-emerald-400/70 hover:text-emerald-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-black/50 hover:bg-emerald-950/30 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> Skip
        </button>
      </div>

      {/* Center Hero Geometric Typography */}
      <div className="relative z-10 max-w-4xl px-6 text-center space-y-8 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-emerald-500/40 bg-black/60 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
          <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-[0.25em] text-emerald-300 uppercase">
            SAInT EXECUTIVE OVERRIDE
          </span>
        </div>

        {/* Geometric Glowing Title */}
        <div className="space-y-3">
          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.18em] uppercase text-transparent bg-clip-text leading-none py-2"
            style={{
              backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 45%, #10b981 85%, #059669 100%)',
              textShadow: '0 0 35px rgba(16, 185, 129, 0.6), 0 0 80px rgba(16, 185, 129, 0.3)',
              letterSpacing: '0.15em',
            }}
          >
            IMPACT <span className="text-emerald-400 font-light mx-2">x</span> DOOMSDAY
          </h1>

          <p className="text-emerald-400/80 text-sm sm:text-base font-mono tracking-[0.3em] uppercase">
            [ CLASSIFIED EVENT PORTAL INITIALIZED ]
          </p>
        </div>

        <p className="max-w-xl mx-auto text-xs sm:text-sm text-slate-400 leading-relaxed font-sans font-normal tracking-wide">
          The high-voltage cyber protocol is active. All department systems, registrations, and quantum channels are synchronizing live.
        </p>

        {/* Action Controls */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleEnter}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl font-mono text-sm font-bold uppercase tracking-widest text-black transition-all duration-300 transform hover:scale-105 cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.7)]"
            style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #10b981 100%)',
            }}
          >
            <ShieldAlert className="w-5 h-5 text-black" />
            <span>Enter SAInT Portal</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Bottom Geometric Accents */}
      <div className="absolute bottom-6 left-8 right-8 z-10 flex items-center justify-between text-[11px] font-mono text-emerald-500/60">
        <span>SECURITY: ENCRYPTED // LEVEL 5</span>
        <span className="hidden sm:inline">JSPM RSCOE IT DEPT</span>
        <span>LATENCY: 0.04ms</span>
      </div>
    </div>
  );
}
