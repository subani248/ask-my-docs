import { useState, useCallback, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GoogleAuthButton from '../components/GoogleAuthButton'

export default function Login() {
  const { login, googleAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = useCallback(async (credential: string) => {
    setError('')
    setLoading(true)
    try {
      await googleAuth(credential)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }, [googleAuth, navigate, from])

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0b100e] overflow-hidden font-sans">
      {/* ── Left panel (Dark Green) ──────────────────────── */}
      <div className="relative flex-1 flex flex-col p-8 lg:p-16 lg:pr-12 text-white overflow-hidden bg-gradient-to-br from-[#121c19] to-[#0a120f]">
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#115e41] opacity-20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#115e41] opacity-10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>

        <div className="relative z-10 max-w-lg">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-2 hover:opacity-90 transition-opacity">
            <div className="relative">
              <svg className="w-8 h-8 text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div className="absolute -bottom-1 -right-2 bg-[#34d399] rounded-md p-0.5">
                <svg className="w-4 h-4 text-[#0b100e]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path>
                  <circle cx="8" cy="9" r="1.5" fill="#0b100e"></circle>
                  <circle cx="12" cy="9" r="1.5" fill="#0b100e"></circle>
                  <circle cx="16" cy="9" r="1.5" fill="#0b100e"></circle>
                </svg>
              </div>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">Ask My <span className="text-[#34d399]">Docs</span></span>
              <p className="text-[11px] text-gray-400 -mt-0.5">Chat with your documents using AI</p>
            </div>
          </Link>

          {/* Headline */}
          <h1 className="mt-16 text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            Turn Your<br />Documents into<br /><span className="text-[#34d399]">Answers</span>
          </h1>

          <p className="mt-6 text-[15px] text-gray-300 leading-relaxed max-w-sm">
            Upload your PDFs, PPTs, or notes and get instant, accurate answers with AI.
          </p>

          {/* Features List */}
          <div className="mt-12 space-y-8">
            {/* Feature 1 */}
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-[#113a2a] flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(52,211,153,0.15)]">
                <svg className="w-6 h-6 text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  <circle cx="8" cy="10" r="1" fill="currentColor"></circle>
                  <circle cx="12" cy="10" r="1" fill="currentColor"></circle>
                  <circle cx="16" cy="10" r="1" fill="currentColor"></circle>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-[15px]">Ask in Natural Language</h3>
                <p className="text-sm text-gray-400 mt-1">Get clear and relevant answers<br/>from your documents.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-[#113a2a] flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(52,211,153,0.15)]">
                <svg className="w-6 h-6 text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-[15px]">Supports Multiple Formats</h3>
                <p className="text-sm text-gray-400 mt-1">PDF, PPT, DOCX and more.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-[#113a2a] flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(52,211,153,0.15)]">
                <svg className="w-6 h-6 text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-[15px]">Fast & Reliable</h3>
                <p className="text-sm text-gray-400 mt-1">Save time and study smarter.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ──────────────────────── */}
      <div className="flex-1 bg-white rounded-l-3xl lg:rounded-l-[2.5rem] shadow-2xl flex flex-col items-center justify-center p-8 lg:p-12 relative z-20 -ml-4 lg:-ml-6">
        <div className="w-full max-w-[420px]">
          
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Welcome Back</h2>
          <p className="mt-2 text-[15px] text-gray-500 mb-10">Login to your Ask My Docs account</p>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-[13px] font-bold text-gray-900 mb-2">Email / User ID</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                    <path d="M2 4l10 8 10-8"></path>
                  </svg>
                </span>
                <input 
                  id="email" 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#115e41] focus:border-transparent transition-all"
                  placeholder="Enter your email or user ID" 
                  autoComplete="email" 
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-[13px] font-bold text-gray-900 mb-2">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#115e41] focus:border-transparent transition-all"
                  placeholder="Enter your password" 
                  autoComplete="current-password" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#115e41] focus:ring-[#115e41] cursor-pointer" 
                />
                <span className="text-[14px] text-gray-700">Remember me</span>
              </label>
              
              <button 
                type="button" 
                className="text-[14px] font-medium text-[#115e41] hover:text-[#0b422e] transition-colors"
                onClick={() => alert('Password recovery will be available soon.')}
              >
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#115e41] text-white py-3.5 text-[15px] font-semibold hover:bg-[#0d4a33] focus:outline-none focus:ring-2 focus:ring-[#115e41] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6 shadow-[0_4px_14px_rgba(17,94,65,0.25)]"
            >
              {loading ? 'Logging in...' : 'Login'}
              {!loading && (
                <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[13px] text-gray-400 font-medium tracking-wide">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Google Button */}
          <GoogleAuthButton text="signin_with" onSuccess={handleGoogleSuccess} />

          {/* Footer Note */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-[#115e41] hover:text-[#0b422e] transition-colors">Register here</Link>
          </p>

        </div>
      </div>
    </div>
  )
}
