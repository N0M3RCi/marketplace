/**
 * LiquidGlass — Premium White & Deep Gold palette.
 * Warm cream base + vivid deep yellow / amber orbs.
 * Luxury brand aesthetic: Rolex / Louis Vuitton energy.
 */

import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   1. Animated Background
───────────────────────────────────────────────*/
export function LiquidGlassBackground({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>

      {/* ── Base: warm cream white ── */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(160deg, #FFFEF0 0%, #FFFDF5 45%, #FFF8E0 100%)',
      }} />

      {/* ── Orb 1: deep gold — top-left bloom ── */}
      <div className="absolute rounded-full" style={{
        width: '85vw', height: '85vw',
        top: '-35%', left: '-30%',
        background: 'radial-gradient(circle at 45% 45%, rgba(240,184,0,0.45) 0%, rgba(220,160,0,0.28) 30%, rgba(200,140,0,0.10) 55%, transparent 70%)',
        filter: 'blur(90px)',
        animation: 'lg-float1 26s ease-in-out infinite',
      }} />

      {/* ── Orb 2: warm amber — bottom-right ── */}
      <div className="absolute rounded-full" style={{
        width: '70vw', height: '70vw',
        bottom: '-28%', right: '-22%',
        background: 'radial-gradient(circle at 55% 55%, rgba(255,200,50,0.38) 0%, rgba(240,170,0,0.22) 38%, transparent 65%)',
        filter: 'blur(100px)',
        animation: 'lg-float2 32s ease-in-out infinite',
      }} />

      {/* ── Orb 3: sunlight yellow — mid-center drift ── */}
      <div className="absolute rounded-full" style={{
        width: '55vw', height: '55vw',
        top: '18%', left: '28%',
        background: 'radial-gradient(circle at 50% 50%, rgba(255,215,0,0.22) 0%, rgba(240,190,0,0.12) 40%, transparent 65%)',
        filter: 'blur(110px)',
        animation: 'lg-float3 22s ease-in-out infinite',
      }} />

      {/* ── Orb 4: pure white glow — top-right ── */}
      <div className="absolute rounded-full" style={{
        width: '45vw', height: '45vw',
        top: '-12%', right: '8%',
        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.90) 0%, rgba(255,250,220,0.50) 45%, transparent 70%)',
        filter: 'blur(75px)',
        animation: 'lg-float4 28s ease-in-out infinite',
      }} />

      {/* ── Orb 5: deep amber anchor — bottom-left ── */}
      <div className="absolute rounded-full" style={{
        width: '50vw', height: '50vw',
        bottom: '-20%', left: '5%',
        background: 'radial-gradient(circle at 50% 50%, rgba(230,160,0,0.28) 0%, rgba(210,140,0,0.12) 50%, transparent 70%)',
        filter: 'blur(85px)',
        animation: 'lg-float1 35s ease-in-out infinite reverse',
      }} />

      {/* ── Surface: warm gold sheen ── */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 65% 38% at 12% 18%, rgba(255,255,255,0.60) 0%, transparent 55%),
          radial-gradient(ellipse 45% 28% at 88% 80%, rgba(240,184,0,0.12) 0%, transparent 50%)
        `,
      }} />

      {/* ── Micro grain: tactile depth ── */}
      <div className="absolute inset-0 opacity-[0.025] mix-blend-multiply" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
      }} />

      {/* ── Top edge: gold glass lip ── */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(240,184,0,0.50) 20%, rgba(255,255,255,0.80) 50%, rgba(240,184,0,0.50) 80%, transparent 100%)',
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   2. Glass Card
───────────────────────────────────────────────*/
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  tint?: 'neutral' | 'gold' | 'white' | 'dark';
  intensity?: 'light' | 'medium' | 'heavy';
  border?: boolean;
}

export function GlassCard({
  children,
  className,
  tint = 'neutral',
  intensity = 'medium',
  border = true,
}: GlassCardProps) {
  const blurMap = { light: 'blur(14px)', medium: 'blur(22px)', heavy: 'blur(44px)' };
  const bgMap = {
    neutral: 'rgba(255,255,255,0.72)',
    gold:    'rgba(255,245,180,0.60)',
    white:   'rgba(255,255,255,0.85)',
    dark:    'rgba(30,20,0,0.55)',
  };
  const borderMap = {
    neutral: 'rgba(240,184,0,0.25)',
    gold:    'rgba(240,184,0,0.45)',
    white:   'rgba(255,255,255,0.90)',
    dark:    'rgba(240,184,0,0.20)',
  };

  return (
    <div className={cn('relative rounded-2xl overflow-hidden', className)}
      style={{
        background: bgMap[tint],
        backdropFilter: blurMap[intensity],
        WebkitBackdropFilter: blurMap[intensity],
        border: border ? `1px solid ${borderMap[tint]}` : undefined,
        boxShadow: '0 8px 40px rgba(180,130,0,0.12), inset 0 1px 0 rgba(255,255,255,0.90)',
      }}>
      {/* Top specular — gold-to-white */}
      <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(240,184,0,0.45), rgba(255,255,255,0.70), rgba(240,184,0,0.45), transparent)' }} />
      {/* Corner glow */}
      <div className="absolute top-0 left-0 w-20 h-20 rounded-2xl pointer-events-none"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.12) 0%, transparent 60%)' }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   3. Glass Pill / Badge
───────────────────────────────────────────────*/
export function GlassPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
      className
    )} style={{
      background: 'rgba(240,184,0,0.15)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(240,184,0,0.35)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.60), 0 2px 12px rgba(180,130,0,0.10)',
      color: '#8B6000',
    }}>
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   4. Glass Button
───────────────────────────────────────────────*/
export function GlassButton({
  children,
  onClick,
  className,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';

  const defaultBg   = isPrimary ? 'rgba(255,255,255,0.70)' : 'rgba(240,184,0,0.90)';
  const hoverBg     = isPrimary ? 'rgba(255,255,255,0.90)' : 'rgba(220,160,0,1)';
  const borderColor = isPrimary ? 'rgba(240,184,0,0.35)' : 'rgba(200,140,0,0.60)';
  const textColor   = isPrimary ? '#5C4000' : '#FFFFFF';
  const shadow      = isPrimary
    ? '0 4px 24px rgba(180,130,0,0.15), inset 0 1px 0 rgba(255,255,255,0.90)'
    : '0 4px 24px rgba(180,130,0,0.35), inset 0 1px 0 rgba(255,240,180,0.40)';

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl',
        'text-sm font-semibold transition-all duration-200',
        'active:scale-[0.97] focus:outline-none focus-visible:ring-1 focus-visible:ring-yellow-400/50',
        className
      )}
      style={{
        background: defaultBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${borderColor}`,
        boxShadow: shadow,
        color: textColor,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = defaultBg; }}
    >
      {/* Top glint */}
      <span className="absolute top-0 left-4 right-4 h-px pointer-events-none"
        style={{ background: isPrimary
          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.90), transparent)'
          : 'linear-gradient(90deg, transparent, rgba(255,240,150,0.60), transparent)' }} />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
