import React, { useState } from 'react';
import { login, getApiUrl } from '../api';
import { Loader2, AlertCircle, User, Lock, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError('');

    try {
      const success = await login(username, password);
      if (success) {
        onLoginSuccess();
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication connection failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = (provider: 'google' | 'github' | 'orcid') => {
    const apiUrl = getApiUrl().replace(/\/$/, '');
    const authBaseUrl = apiUrl.replace(/\/amaretti$/, '/auth');
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${authBaseUrl}/${provider}/signin?redirect=${redirectUrl}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-dark overflow-hidden font-sans select-none">
      {/* Dynamic background glow spheres */}
      <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-accent-cyan/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 h-96 w-96 rounded-full bg-accent-purple/5 blur-[120px] pointer-events-none" />

      {/* Login Box */}
      <div className="relative z-10 w-full max-w-md p-8 glass rounded-3xl border border-border-glass shadow-[0_20px_50px_rgba(0,0,0,0.3)] mx-4">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-cyan/20 to-accent-purple/10 ring-1 ring-accent-cyan/30 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
            <img src="/Assets/icon1.png" alt="Amaretti Logo" className="h-10 w-10 object-contain" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-wider text-text-main">
            Brainlife Workflow
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Sign in to access your live orchestration dashboard
          </p>
        </div>

        {/* SSO Login Options */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => handleSsoLogin('google')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.01] py-2.5 text-xs text-text-muted hover:bg-white/[0.03] hover:text-text-main hover:border-white/20 active:scale-[0.97] transition-all cursor-pointer"
            title="Login with Google"
          >
            <svg className="h-5 w-5 text-text-muted group-hover:text-text-main" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.187 4.114-3.565 0-6.446-2.881-6.446-6.446 0-3.565 2.881-6.446 6.446-6.446 1.637 0 3.12.608 4.26 1.605l3.197-3.197C19.043 1.956 15.824 1 12.24 1 6.136 1 12.24 23.48 12.24 23.48c5.84 0 10.748-4.103 10.748-10.748 0-.497-.042-.993-.122-1.447H12.24z"/>
            </svg>
            <span className="text-[10px] font-semibold">Google</span>
          </button>
          
          <button
            onClick={() => handleSsoLogin('github')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.01] py-2.5 text-xs text-text-muted hover:bg-white/[0.03] hover:text-text-main hover:border-white/20 active:scale-[0.97] transition-all cursor-pointer"
            title="Login with GitHub"
          >
            <svg className="h-5 w-5 text-text-muted group-hover:text-text-main" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            <span className="text-[10px] font-semibold">GitHub</span>
          </button>
          
          <button
            onClick={() => handleSsoLogin('orcid')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.01] py-2.5 text-xs text-text-muted hover:bg-white/[0.03] hover:text-text-main hover:border-white/20 active:scale-[0.97] transition-all cursor-pointer"
            title="Login with ORCID"
          >
            <svg className="h-5 w-5 text-text-muted group-hover:text-text-main" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.531 0 .963.432.963.963 0 .531-.432.962-.963.962s-.962-.432-.962-.962c0-.531.431-.963.962-.963zm0 3.336H6.128v11.908h1.241V7.714zm8.681.026c-1.398 0-2.553.791-3.138 1.916V7.74h-1.24v11.882h1.24V11.23c0-2.072 1.341-3.413 3.413-3.413 2.072 0 3.413 1.341 3.413 3.413v8.392h1.24V11.23c0-2.825-2.05-4.89-4.928-4.89z"/>
            </svg>
            <span className="text-[10px] font-semibold">ORCID</span>
          </button>
        </div>

        {/* Separator */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.06]" />
          </div>
          <span className="relative bg-bg-dark px-3 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Or continue with
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl bg-status-error/5 border border-status-error/15 p-3.5 mb-6 text-xs text-status-error">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-status-error" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Username or Email
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" strokeWidth={1.75} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter your username or email"
                className="w-full rounded-xl border border-border-glass bg-white/[0.01] py-2.5 pl-10 pr-4 text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" strokeWidth={1.75} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border-glass bg-white/[0.01] py-2.5 pl-10 pr-4 text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition-all"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 relative flex items-center justify-center gap-2 rounded-xl bg-accent-cyan px-4 py-3 text-xs font-bold text-bg-dark hover:bg-accent-cyan-dim disabled:opacity-50 active:scale-[0.99] transition-all shadow-[0_4px_20px_rgba(0,229,255,0.25)] select-none cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-bg-dark" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4 text-bg-dark" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
