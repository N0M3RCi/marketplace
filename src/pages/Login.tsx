import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, User, ArrowLeft, KeyRound } from 'lucide-react';
import { LiquidGlassBackground, GlassCard } from '@/components/features/LiquidGlass';
import { sendOtp, verifyOtpAndSetPassword, signInWithPassword, mapSupabaseUser } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Mode = 'login' | 'register';
type RegisterStep = 'email' | 'otp' | 'password';

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<RegisterStep>('email');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regEmail, setRegEmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const inputStyle = {
    background: 'rgba(255,255,255,0.70)',
    border: '1px solid rgba(240,184,0,0.28)',
    color: '#1A1000',
    boxShadow: 'inset 0 1px 3px rgba(180,130,0,0.06)',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const user = await signInWithPassword(loginEmail, loginPassword);
      const authUser = mapSupabaseUser(user);
      toast.success(`Welcome back, ${authUser.username}!`);
      await refresh();
      if (authUser.role === 'admin') navigate('/admin');
      else navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      setLoginLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    try {
      await sendOtp(regEmail);
      toast.success('Verification code sent to your email');
      setStep('otp');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send code');
    } finally {
      setRegLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regOtp.length !== 4) { toast.error('Enter the 4-digit code'); return; }
    setStep('password');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setRegLoading(true);
    try {
      const user = await verifyOtpAndSetPassword(regEmail, regOtp, regPassword, regUsername);
      const authUser = mapSupabaseUser(user);
      toast.success(`Welcome to SafeEscrow, ${authUser.username}!`);
      await refresh();
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
      setRegLoading(false);
    }
  };

  const primaryBtn = {
    background: 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)',
    border: '1px solid rgba(200,140,0,0.40)',
    color: '#FFFFFF',
    boxShadow: '0 4px 20px rgba(180,130,0,0.35)',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#FFFDF5' }}>
      <LiquidGlassBackground />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)', boxShadow: '0 4px 16px rgba(180,130,0,0.35)' }}>
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight" style={{ color: '#1A1000' }}>
            Safe<span style={{ color: '#C68000' }}>Escrow</span>
          </span>
        </Link>

        <GlassCard tint="white" intensity="heavy" className="overflow-hidden">
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid rgba(240,184,0,0.18)' }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setStep('email'); }}
                className="flex-1 py-4 text-sm font-semibold capitalize transition-all"
                style={mode === m
                  ? { color: '#C68000', borderBottom: '2px solid #C68000', background: 'rgba(240,184,0,0.06)' }
                  : { color: '#9A7C40' }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="font-heading text-xl font-bold mb-1" style={{ color: '#1A1000' }}>Welcome back</h2>
                  <p className="text-sm" style={{ color: '#7A5C20' }}>Sign in to your SafeEscrow account</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5020' }}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                    <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/40 transition-all"
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5020' }}>Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                    <input type={showLoginPwd ? 'text' : 'password'} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/40 transition-all"
                      style={inputStyle} />
                    <button type="button" onClick={() => setShowLoginPwd(!showLoginPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9A7C40' }}>
                      {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loginLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all h-11"
                  style={primaryBtn}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #D09000 0%, #E0A800 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'; }}>
                  {loginLoading ? 'Signing in…' : 'Sign In'}
                </button>
                <p className="text-center text-xs" style={{ color: '#9A7C40' }}>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setMode('register')} className="font-semibold hover:underline" style={{ color: '#C68000' }}>
                    Create one
                  </button>
                </p>
              </form>
            )}

            {/* REGISTER — STEP 1: EMAIL */}
            {mode === 'register' && step === 'email' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <h2 className="font-heading text-xl font-bold mb-1" style={{ color: '#1A1000' }}>Create your account</h2>
                  <p className="text-sm" style={{ color: '#7A5C20' }}>Enter your email to receive a verification code</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5020' }}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                    <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/40 transition-all"
                      style={inputStyle} />
                  </div>
                </div>
                <button type="submit" disabled={regLoading} className="w-full py-3 rounded-xl text-sm font-bold transition-all h-11" style={primaryBtn}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #D09000 0%, #E0A800 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'; }}>
                  {regLoading ? 'Sending code…' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {/* REGISTER — STEP 2: OTP */}
            {mode === 'register' && step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <button type="button" onClick={() => setStep('email')} style={{ color: '#9A7C40' }}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="font-heading text-xl font-bold" style={{ color: '#1A1000' }}>Check your email</h2>
                </div>
                <p className="text-sm" style={{ color: '#7A5C20' }}>
                  We sent a 4-digit code to <span className="font-semibold" style={{ color: '#1A1000' }}>{regEmail}</span>
                </p>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5020' }}>Verification Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                    <input type="text" required maxLength={4} value={regOtp} onChange={e => setRegOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none tracking-widest text-center font-mono text-lg transition-all"
                      style={inputStyle} />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold h-11 transition-all" style={primaryBtn}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #D09000 0%, #E0A800 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'; }}>
                  Verify Code
                </button>
                <p className="text-center text-xs" style={{ color: '#9A7C40' }}>
                  Didn't receive it?{' '}
                  <button type="button" onClick={() => sendOtp(regEmail).then(() => toast.success('Code resent!')).catch(() => toast.error('OTP is not supported — use email/password login'))} className="font-semibold hover:underline" style={{ color: '#C68000' }}>
                    Resend
                  </button>
                </p>
              </form>
            )}

            {/* REGISTER — STEP 3: USERNAME + PASSWORD */}
            {mode === 'register' && step === 'password' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <button type="button" onClick={() => setStep('otp')} style={{ color: '#9A7C40' }}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="font-heading text-xl font-bold" style={{ color: '#1A1000' }}>Set up your profile</h2>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5020' }}>Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                    <input type="text" required value={regUsername} onChange={e => setRegUsername(e.target.value)}
                      placeholder="yourname"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/40 transition-all"
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5020' }}>Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                    <input type={showRegPwd ? 'text' : 'password'} required value={regPassword} onChange={e => setRegPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/40 transition-all"
                      style={inputStyle} />
                    <button type="button" onClick={() => setShowRegPwd(!showRegPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9A7C40' }}>
                      {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={regLoading} className="w-full py-3 rounded-xl text-sm font-bold h-11 transition-all" style={primaryBtn}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #D09000 0%, #E0A800 100%)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'; }}>
                  {regLoading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </GlassCard>

        <p className="text-center text-xs mt-6" style={{ color: '#9A7C40' }}>
          Protected by 256-bit encryption · SafeEscrow Platform
        </p>
      </div>
    </div>
  );
}
