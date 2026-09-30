import React, { useState } from 'react';
import { login, getApiUrl, NonAdminError } from '../api';
import { useDashboardStore } from '../store/useDashboardStore';
import { Loader2, AlertCircle, User, Lock, ArrowRight, AlertTriangle, LogOut } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { nonAdminAttemptUser, setNonAdminAttemptUser } = useDashboardStore();

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
      if (err instanceof NonAdminError) {
        setNonAdminAttemptUser(err.userProfile);
      } else {
        const msg = err instanceof Error ? err.message : 'Authentication connection failed';
        setError(msg);
      }
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
    <div className="relative flex min-h-screen items-center justify-center bg-[#161C26] overflow-hidden font-sans select-none">
      {/* Login Box */}
      <div className="relative z-10 w-full max-w-md p-8 bg-[#1E2532] rounded-2xl border border-border-glass shadow-xl mx-4">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D3748] shadow-md p-3">
            <img src={`${import.meta.env.BASE_URL}Assets/logo.svg`} alt="Brainlife Logo" className="h-8 w-8 object-contain" />
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
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-[#161C26] py-2.5 text-xs text-text-main hover:bg-[#252E3E] hover:border-border-glass-hover shadow-sm active:scale-[0.97] transition-all cursor-pointer"
            title="Login with Google"
          >
            <svg className="h-5 w-5 text-text-main" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.187 4.114-3.565 0-6.446-2.881-6.446-6.446 0-3.565 2.881-6.446 6.446-6.446 1.637 0 3.12.608 4.26 1.605l3.197-3.197C19.043 1.956 15.824 1 12.24 1 6.136 1 12.24 23.48 12.24 23.48c5.84 0 10.748-4.103 10.748-10.748 0-.497-.042-.993-.122-1.447H12.24z"/>
            </svg>
            <span className="text-[10px] font-semibold">Google</span>
          </button>
          
          <button
            onClick={() => handleSsoLogin('github')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-[#161C26] py-2.5 text-xs text-text-main hover:bg-[#252E3E] hover:border-border-glass-hover shadow-sm active:scale-[0.97] transition-all cursor-pointer"
            title="Login with GitHub"
          >
            <svg className="h-5 w-5 text-text-main" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            <span className="text-[10px] font-semibold">GitHub</span>
          </button>
          
          <button
            onClick={() => handleSsoLogin('orcid')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-[#161C26] py-2.5 text-xs text-text-main hover:bg-[#252E3E] hover:border-border-glass-hover shadow-sm active:scale-[0.97] transition-all cursor-pointer"
            title="Login with ORCID"
          >
            <svg className="h-5 w-5 text-text-main" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.531 0 .963.432.963.963 0 .531-.432.962-.963.962s-.962-.432-.962-.962c0-.531.431-.963.962-.963zm0 3.336H6.128v11.908h1.241V7.714zm8.681.026c-1.398 0-2.553.791-3.138 1.916V7.74h-1.24v11.882h1.24V11.23c0-2.072 1.341-3.413 3.413-3.413 2.072 0 3.413 1.341 3.413 3.413v8.392h1.24V11.23c0-2.825-2.05-4.89-4.928-4.89z"/>
            </svg>
            <span className="text-[10px] font-semibold">ORCID</span>
          </button>
        </div>

        {/* Separator */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-glass" />
          </div>
          <span className="relative bg-[#1E2532] px-3 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Or continue with
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl bg-status-error/10 border border-status-error/20 p-3.5 mb-6 text-xs text-status-error font-medium">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-status-error" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full rounded-xl border border-border-glass bg-[#161C26] py-2.5 pl-10 pr-4 text-xs text-text-main placeholder:text-text-faint focus:bg-[#121620] focus:border-[#3182CE] focus:outline-none transition-all shadow-sm"
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
                className="w-full rounded-xl border border-border-glass bg-[#161C26] py-2.5 pl-10 pr-4 text-xs text-text-main placeholder:text-text-faint focus:bg-[#121620] focus:border-[#3182CE] focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 relative flex items-center justify-center gap-2 rounded-xl bg-[#2D3748] hover:bg-[#323F54] px-4 py-3 text-xs font-semibold text-white border border-[#4A5568] disabled:opacity-50 active:scale-[0.99] transition-all shadow-md select-none cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4 text-white" />
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Non-Admin Access Denied Modal */}
      {nonAdminAttemptUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-border-glass bg-[#1E2532] p-6 shadow-2xl">
            {/* Brainlife Brand Icon */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D3748] border border-[#3A4352] p-2.5 mb-4 shadow-sm">
              <img
                src={`${import.meta.env.BASE_URL}Assets/icon1.png`}
                alt="Brainlife"
                className="h-8 w-8 object-contain"
              />
            </div>

            {/* Title & Description */}
            <h3 className="text-center text-lg font-bold text-white tracking-wide">
              Administrator Access Required
            </h3>
            <p className="mt-2 text-center text-xs text-text-muted leading-relaxed">
              This platform is an internal monitoring and orchestration console restricted exclusively to <span className="text-white font-medium">Brainlife platform administrators</span>.
            </p>

            {/* Account Details Box */}
            <div className="mt-5 rounded-xl border border-border-glass bg-[#161C26] p-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-glass/60">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-faint">
                  Authenticated Account
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                  Non-Admin User
                </span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Username:</span>
                  <span className="font-mono text-text-main font-semibold">@{nonAdminAttemptUser.username}</span>
                </div>
                {nonAdminAttemptUser.fullname && (
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Full Name:</span>
                    <span className="text-text-main">{nonAdminAttemptUser.fullname}</span>
                  </div>
                )}
                {nonAdminAttemptUser.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Email:</span>
                    <span className="text-text-main">{nonAdminAttemptUser.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notice */}
            <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-200/90 leading-tight">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Your credentials are valid, but your Brainlife account does not have <code>admin</code> scopes granted. Please log in with an administrator account.
              </span>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => {
                setNonAdminAttemptUser(null);
                setPassword('');
                setError('');
              }}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#2D3748] hover:bg-[#38465B] border border-[#4A5568] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign In with Another Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
