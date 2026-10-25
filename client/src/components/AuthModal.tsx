import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  X, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    authModalMode, 
    closeAuthModal, 
    openAuthModal, 
    login, 
    register, 
    loginAsDemoEvaluator,
    authError,
    clearAuthError
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // Reset form when modal opens or mode changes
  useEffect(() => {
    if (isAuthModalOpen) {
      setEmailTouched(false);
      setPasswordTouched(false);
      clearAuthError();
    }
  }, [isAuthModalOpen, authModalMode, clearAuthError]);

  if (!isAuthModalOpen) return null;

  const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasNumberOrSymbol;

  const canSubmit = isEmailValid && isPasswordValid && (!isSubmitting);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      if (authModalMode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim());
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoEvaluatorLogin = async () => {
    setEmail('evaluator@supplysync.io');
    setEmailTouched(true);
    setIsSubmitting(true);
    try {
      const success = await loginAsDemoEvaluator();
      if (!success) {
        // If server-side demo login is unavailable (e.g. production), prefill email and focus password for manual entry
        setPassword('');
        setPasswordTouched(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#191B19]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E5E6E0] shadow-2xl space-y-6 my-auto">
        {/* Header with Mode Toggle & Close */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF1EA] text-[#526B50] flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-[#191B19]">
                {authModalMode === 'login' ? 'Sign In to SupplySync' : 'Create Planner Account'}
              </h2>
              <p className="text-xs text-[#70736E] mt-0.5">
                {authModalMode === 'login' 
                  ? 'Access distribution engine and saved optimization plans.' 
                  : 'Register a verified operator account for supply planning.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="p-2 rounded-xl text-[#70736E] hover:text-[#191B19] hover:bg-[#F7F7F4] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-[#F7F7F4] border border-[#E5E6E0] text-xs font-medium">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer text-center ${
              authModalMode === 'login'
                ? 'bg-white text-[#191B19] font-bold shadow-xs'
                : 'text-[#70736E] hover:text-[#191B19]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => openAuthModal('register')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer text-center ${
              authModalMode === 'register'
                ? 'bg-white text-[#191B19] font-bold shadow-xs'
                : 'text-[#70736E] hover:text-[#191B19]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert Banner */}
        {authError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Authentication Notice: </span>
              {authError}
            </div>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Name Field (Register Mode Only) */}
          {authModalMode === 'register' && (
            <div className="space-y-1.5">
              <label className="block font-semibold text-[#191B19]">
                Full Name <span className="text-[#70736E] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#70736E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E6E0] bg-[#F7F7F4] focus:bg-white focus:border-[#526B50] focus:ring-1 focus:ring-[#526B50] outline-hidden transition-all text-[#191B19] placeholder:text-[#A0A39C]"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block font-semibold text-[#191B19]">
                Email Address
              </label>
              {emailTouched && (
                <span className={`text-[10px] ${isEmailValid ? 'text-[#526B50]' : 'text-red-500'}`}>
                  {isEmailValid ? 'Valid email' : 'Please enter a valid email'}
                </span>
              )}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#70736E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="planner@company.com"
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border ${
                  emailTouched && !isEmailValid 
                    ? 'border-red-300 bg-red-50/30' 
                    : 'border-[#E5E6E0] bg-[#F7F7F4]'
                } focus:bg-white focus:border-[#526B50] focus:ring-1 focus:ring-[#526B50] outline-hidden transition-all text-[#191B19] placeholder:text-[#A0A39C]`}
              />
            </div>
          </div>

          {/* Password Field with Visibility Toggle */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block font-semibold text-[#191B19]">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#70736E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border ${
                  passwordTouched && !isPasswordValid 
                    ? 'border-red-300 bg-red-50/30' 
                    : 'border-[#E5E6E0] bg-[#F7F7F4]'
                } focus:bg-white focus:border-[#526B50] focus:ring-1 focus:ring-[#526B50] outline-hidden transition-all text-[#191B19] placeholder:text-[#A0A39C]`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#70736E] hover:text-[#191B19] transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Requirement Indicators (in Register mode or if touched) */}
            {(authModalMode === 'register' || (passwordTouched && !isPasswordValid)) && (
              <div className="pt-1.5 space-y-1 text-[11px] text-[#70736E]">
                <div className="flex items-center gap-1.5">
                  {hasMinLength ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#526B50]" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-[#D0D2C8] inline-block" />
                  )}
                  <span className={hasMinLength ? 'text-[#526B50] font-medium' : ''}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasLetter && hasNumberOrSymbol ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#526B50]" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-[#D0D2C8] inline-block" />
                  )}
                  <span className={hasLetter && hasNumberOrSymbol ? 'text-[#526B50] font-medium' : ''}>
                    Contains both letters and numbers/symbols
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full bg-[#191B19] hover:bg-[#2E312E] disabled:bg-[#A0A39C] disabled:cursor-not-allowed text-white text-xs font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98"
          >
            {isSubmitting ? (
              <span>{authModalMode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
            ) : (
              <>
                <span>{authModalMode === 'login' ? 'Sign In to SupplySync' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#E5E6E0] w-full" />
          <span className="bg-white px-3 text-[11px] font-medium text-[#70736E] uppercase tracking-wider">
            Evaluation Access
          </span>
        </div>

        {/* Competition Evaluator 1-Click Access Card */}
        <div className="p-3.5 rounded-2xl bg-[#EBF1EA]/60 border border-[#D3DFD2] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#526B50]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Triwizathon 2026 Judge Access</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#526B50] font-semibold border border-[#D3DFD2]">
              Lead Planner
            </span>
          </div>
          <p className="text-[11px] text-[#526B50] leading-relaxed">
            One-click authentication using the pre-seeded persistent evaluator account (<code className="font-mono text-[#191B19]">evaluator@supplysync.io</code>).
          </p>
          <button
            type="button"
            onClick={handleDemoEvaluatorLogin}
            disabled={isSubmitting}
            className="w-full bg-white hover:bg-[#F7F7F4] text-[#191B19] border border-[#D3DFD2] text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs active:scale-98"
          >
            <ShieldCheck className="w-4 h-4 text-[#526B50]" />
            <span>Sign In as Competition Evaluator</span>
          </button>
        </div>

        {/* Footer switch mode text */}
        <div className="text-center text-xs text-[#70736E]">
          {authModalMode === 'login' ? (
            <span>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="font-bold text-[#191B19] hover:text-[#526B50] underline cursor-pointer ml-1"
              >
                Register here
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="font-bold text-[#191B19] hover:text-[#526B50] underline cursor-pointer ml-1"
              >
                Sign in here
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
