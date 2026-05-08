import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { loginUser, registerUser, validateMFA } from '../api/auth'

// ── Background Lightning Animation Component ───────────────────────────────
const LightningBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <style>{`
      @keyframes lightningStrike {
        0% { opacity: 0; }
        2% { opacity: 0.8; }
        3% { opacity: 0; }
        4% { opacity: 0.8; }
        10% { opacity: 0; }
        100% { opacity: 0; }
      }
      .lightning-flash {
        animation: lightningStrike 8s infinite;
        background: radial-gradient(circle at 70% 30%, rgba(59, 130, 246, 0.15) 0%, transparent 60%);
      }
      .lightning-bolt {
        position: absolute;
        top: 0;
        right: 20%;
        width: 2px;
        height: 40%;
        background: linear-gradient(to bottom, rgba(59,130,246,0.8), transparent);
        transform: rotate(15deg);
        filter: blur(1px);
        animation: lightningStrike 8s infinite;
      }
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
      .floating-element {
        animation: float 6s ease-in-out infinite;
      }
    `}</style>
    <div className="absolute inset-0 lightning-flash"></div>
    <div className="lightning-bolt"></div>
    {/* Grid pattern */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTU5IDYwaC0xVjFoLTFWMGgydjYwem0tNTkgMHYtMUgxdjFoLTFWMGgydjYwSDB6IiBmaWxsPSIjMWUyOTNiIiBmaWxsLW9wYWNpdHk9IjAuNSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-transparent to-[#0f172a]"></div>
  </div>
)

export default function Login() {
  const [activeTab, setActiveTab] = useState('home')
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  // Auth State
  const [authTab, setAuthTab] = useState('login')
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
  const [useBackup, setUseBackup] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const mfaInputs = useRef([])

  const setToken = useStore((s) => s.setToken)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()

  // Prevent background scrolling when login drawer is open
  useEffect(() => {
    if (isLoginOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isLoginOpen])

  // Auth Handlers
  const handleNextStep = (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (authTab === 'login') {
        const res = await loginUser(email, password)
        const data = res.data

        if (data.requires_mfa) {
          setTempToken(data.temp_token)
          setMfaRequired(true)
          setLoading(false)
          return
        }

        const token = data.accessToken || data.token
        if (!token) throw new Error('No token received')
        setToken(token)
        setUser(data.user || { email })
        navigate('/dashboard')
      } else {
        const payload = {
          email,
          password,
          full_name: fullName || undefined,
          phone: phone || undefined,
          company: company || undefined,
          job_title: jobTitle || undefined
        }
        
        const res = await registerUser(payload)
        const data = res.data

        const token = data.accessToken || data.token
        if (!token) throw new Error('No token received')
        setToken(token)
        setUser(data.user || { email })
        navigate('/dashboard')
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = { temp_token: tempToken }
      if (useBackup) {
        payload.backup_code = backupCode
      } else {
        payload.totp_code = mfaCode.join('')
      }
      const res = await validateMFA(payload)
      const token = res.data.accessToken
      if (!token) throw new Error('No token received')
      setToken(token)
      setUser(res.data.user || { email })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'MFA verification failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleMfaCodeChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const digit = value.slice(-1)
    const next = [...mfaCode]
    next[index] = digit
    setMfaCode(next)
    if (digit && index < 5) mfaInputs.current[index + 1]?.focus()
  }

  function handleMfaKeyDown(index, e) {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      mfaInputs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      mfaInputs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      mfaInputs.current[index + 1]?.focus()
    }
  }

  function handleMfaPaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...mfaCode]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || ''
    setMfaCode(next)
    const lastFilledIndex = Math.min(pasted.length, 5)
    mfaInputs.current[lastFilledIndex]?.focus()
  }

  // ── Main Content Components ──────────────────────────────────────────────
  
  const renderHomeContent = () => (
    <div className="flex flex-col items-center justify-center text-center animate-[fadeIn_0.5s_ease-out] relative z-10 pt-20">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        CloudyBro v4.0 is Live
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl">
        Self-Healing Cloud Infrastructure
      </h1>
      <p className="text-lg md:text-xl text-[#94a3b8] max-w-2xl mb-12 leading-relaxed">
        Your 24/7 DevOps Guardian. We monitor, diagnose, and automatically resolve infrastructure anomalies across AWS, Azure, and GCP using multi-agent AI.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => setIsLoginOpen(true)}
          className="px-8 py-4 bg-[#3b82f6] text-white rounded-lg font-bold hover:bg-[#2563eb] transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
        >
          Start Free Trial
        </button>
        <button 
          onClick={() => setActiveTab('features')}
          className="px-8 py-4 bg-[#1e293b] border border-[#334155] text-white rounded-lg font-bold hover:bg-[#334155] transition-colors"
        >
          See How It Works
        </button>
      </div>

      <div className="mt-20 pt-10 border-t border-[#334155] w-full max-w-4xl flex flex-wrap justify-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
        <div className="flex items-center gap-2 text-xl font-bold font-mono"><span className="text-[#3b82f6]">AWS</span> Amazon Web Services</div>
        <div className="flex items-center gap-2 text-xl font-bold font-mono"><span className="text-[#3b82f6]">GCP</span> Google Cloud</div>
        <div className="flex items-center gap-2 text-xl font-bold font-mono"><span className="text-[#3b82f6]">AZR</span> Microsoft Azure</div>
      </div>
    </div>
  )

  const renderFeaturesContent = () => (
    <div className="max-w-5xl mx-auto w-full animate-[fadeIn_0.5s_ease-out] relative z-10 pt-10 pb-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-extrabold text-white mb-4">How CloudyBro Prevents Downtime</h2>
        <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">A fully autonomous pipeline that watches your infrastructure 24/7.</p>
      </div>

      <div className="space-y-12 relative before:absolute before:inset-0 before:ml-[50%] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#3b82f6] before:to-transparent">
        
        {/* Step 1 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-[#3b82f6] text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_rgba(59,130,246,0.5)] relative z-10">1</div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-xl border border-[#334155] bg-[#1e293b] floating-element">
            <div className="text-[#3b82f6] font-mono text-xs mb-2">t=0s</div>
            <h3 className="text-xl font-bold text-white mb-2">Anomaly Detected</h3>
            <p className="text-[#94a3b8] text-sm">A sudden CPU spike occurs on the inventory-service container in AWS us-east-1.</p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-[#3b82f6] text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_rgba(59,130,246,0.5)] relative z-10">2</div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-xl border border-[#334155] bg-[#1e293b] floating-element" style={{animationDelay: '1s'}}>
            <div className="text-[#3b82f6] font-mono text-xs mb-2">t=1.2s</div>
            <h3 className="text-xl font-bold text-white mb-2">AI Diagnostics (Claude)</h3>
            <p className="text-[#94a3b8] text-sm">The Claude LLM ingests the metrics and traces, identifying a rogue caching thread causing the spike.</p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-[#3b82f6] text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_rgba(59,130,246,0.5)] relative z-10">3</div>
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-xl border border-[#334155] bg-[#1e293b] floating-element" style={{animationDelay: '2s'}}>
            <div className="text-[#3b82f6] font-mono text-xs mb-2">t=3.5s</div>
            <h3 className="text-xl font-bold text-white mb-2">Auto-Healing Triggered</h3>
            <p className="text-[#94a3b8] text-sm">Action Hub executes a secure playbook to gracefully restart the pod without dropping active requests.</p>
          </div>
        </div>

      </div>
    </div>
  )

  const renderPricingContent = () => (
    <div className="max-w-6xl mx-auto w-full animate-[fadeIn_0.5s_ease-out] relative z-10 pt-10 pb-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-extrabold text-white mb-4">Transparent Pricing</h2>
        <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">Start for free, scale when your infrastructure demands it.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Free */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-2">Hobbyist</h3>
          <p className="text-[#94a3b8] text-sm mb-6">For personal projects and testing.</p>
          <div className="mb-8"><span className="text-4xl font-extrabold text-white">$0</span><span className="text-[#94a3b8]">/mo</span></div>
          <ul className="space-y-4 text-sm text-[#cbd5e1] mb-8 flex-1">
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> 1 Cluster Support</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Basic Metrics (5m resolution)</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Email Alerts</li>
          </ul>
          <button onClick={() => setIsLoginOpen(true)} className="w-full py-3 bg-[#334155] hover:bg-[#475569] text-white rounded-lg font-bold transition-colors">Start Free</button>
        </div>

        {/* Pro */}
        <div className="bg-[#0f172a] border-2 border-[#3b82f6] rounded-2xl p-8 flex flex-col relative shadow-[0_0_30px_rgba(59,130,246,0.2)] scale-105">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#3b82f6] text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider">MOST POPULAR</div>
          <h3 className="text-xl font-bold text-white mb-2">Professional</h3>
          <p className="text-[#94a3b8] text-sm mb-6">For growing teams and startups.</p>
          <div className="mb-8"><span className="text-4xl font-extrabold text-white">$49</span><span className="text-[#94a3b8]">/mo</span></div>
          <ul className="space-y-4 text-sm text-[#cbd5e1] mb-8 flex-1">
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> 5 Clusters Support</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> High-Res Metrics (1m)</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Slack & PagerDuty Integration</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Claude AI Diagnostics</li>
          </ul>
          <button onClick={() => setIsLoginOpen(true)} className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg font-bold transition-colors">Start Trial</button>
        </div>

        {/* Enterprise */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
          <p className="text-[#94a3b8] text-sm mb-6">Mission-critical infrastructure.</p>
          <div className="mb-8"><span className="text-4xl font-extrabold text-white">Custom</span></div>
          <ul className="space-y-4 text-sm text-[#cbd5e1] mb-8 flex-1">
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Unlimited Clusters</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Auto-Healing Playbooks</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> SSO / SAML Authentication</li>
            <li className="flex items-center gap-3"><svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Dedicated Account Manager</li>
          </ul>
          <button className="w-full py-3 bg-[#334155] hover:bg-[#475569] text-white rounded-lg font-bold transition-colors">Contact Sales</button>
        </div>
      </div>
    </div>
  )

  const renderDocsContent = () => (
    <div className="max-w-3xl mx-auto w-full animate-[fadeIn_0.5s_ease-out] relative z-10 pt-10 pb-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-extrabold text-white mb-4">Frequently Asked Questions</h2>
        <p className="text-[#94a3b8] text-lg">Everything you need to know about CloudyBro.</p>
      </div>

      <div className="space-y-4">
        {[
          { q: "How does CloudyBro access my metrics?", a: "We provide lightweight, open-source agents (CloudyBro Collectors) that run securely within your environment. They push telemetry out to our ingestion endpoints. We do not require inbound firewall access to your servers." },
          { q: "Is the AI analysis secure?", a: "Yes. Telemetry sent to the Claude API is fully anonymized. We strip all PII, secrets, and environment variables before passing logs to the AI engine." },
          { q: "Can I self-host the platform?", a: "Yes. CloudyBro is designed as a microservices architecture using Docker Compose. Enterprise customers can deploy the entire stack on their own air-gapped infrastructure." },
          { q: "How do Auto-Healing Playbooks work?", a: "Playbooks are strict, pre-approved scripts (like restarting a pod or clearing a tmp folder). The AI recommends an action, but it requires explicit approval unless you configure an automated rule." }
        ].map((faq, i) => (
          <div key={i} className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
            <p className="text-[#94a3b8] leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Login Drawer Component ───────────────────────────────────────────────
  
  const renderLoginDrawer = () => (
    <>
      {/* Backdrop */}
      {isLoginOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-[fadeIn_0.3s_ease-out]"
          onClick={() => setIsLoginOpen(false)}
        ></div>
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-[#111827] border-l border-[#1e293b] shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto ${isLoginOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <button 
          onClick={() => setIsLoginOpen(false)}
          className="absolute top-6 right-6 p-2 text-[#94a3b8] hover:text-white bg-[#1e293b] rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-8 sm:p-12 min-h-full flex flex-col justify-center">
          
          <div className="flex flex-col items-center justify-center mb-10">
            {/* Enlarged Logo here */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl shadow-lg mb-6">
              <img src="/logo.png" alt="CloudyBro" className="w-16 h-16" />
            </div>
            <h2 className="text-2xl mb-1 font-extrabold text-white tracking-tight text-center">
              {mfaRequired ? 'Two-Factor Auth' : authTab === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-[#94a3b8] text-sm text-center">
              {mfaRequired ? (!useBackup ? "Enter the 6-digit code from your authenticator app" : "Enter one of your backup codes") : 
               authTab === 'login' ? 'Sign in to your CloudyBro control plane' : 
               step === 1 ? 'Step 1: Account Setup' : 'Step 2: Profile Details'}
            </p>
          </div>

          {mfaRequired ? (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {!useBackup ? (
                <div className="flex justify-between gap-2 mb-8" onPaste={handleMfaPaste}>
                  {mfaCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (mfaInputs.current[i] = el)}
                      value={digit}
                      onChange={(e) => handleMfaCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleMfaKeyDown(i, e)}
                      maxLength={1}
                      className="w-12 h-14 text-center text-xl font-bold rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                    />
                  ))}
                </div>
              ) : (
                <input
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="e.g., a1b2c3d4"
                  className="w-full px-4 py-3.5 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white mb-8 text-center font-mono text-lg focus:outline-none focus:border-[#3b82f6] transition-all"
                />
              )}

              {error && <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg mb-6 text-center">{error}</div>}

              <button
                onClick={handleMfaSubmit}
                disabled={loading}
                className="w-full py-3.5 bg-[#3b82f6] text-white font-bold text-sm rounded-lg hover:bg-[#2563eb] disabled:opacity-50 transition-colors mb-6 shadow-lg shadow-blue-500/20"
              >
                {loading ? 'Verifying...' : 'Verify →'}
              </button>

              <div className="flex justify-between text-sm">
                <button onClick={() => { setUseBackup(!useBackup); setError('') }} className="text-[#3b82f6] hover:underline bg-transparent font-medium">
                  {useBackup ? 'Use authenticator code' : 'Use a backup code instead'}
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              <div className="flex border-b border-[#334155] mb-8 bg-[#0f172a] rounded-t-lg">
                <button
                  onClick={() => { setAuthTab('login'); setStep(1); setError('') }}
                  className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                    authTab === 'login' ? 'text-[#3b82f6] border-[#3b82f6]' : 'text-[#64748b] hover:text-white border-transparent'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthTab('register'); setError('') }}
                  className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                    authTab === 'register' ? 'text-[#3b82f6] border-[#3b82f6]' : 'text-[#64748b] hover:text-white border-transparent'
                  }`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={authTab === 'login' ? handleSubmit : (step === 1 ? handleNextStep : handleSubmit)} className="space-y-5">
                {(authTab === 'login' || (authTab === 'register' && step === 1)) && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-[#e2e8f0] mb-2">Email address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#e2e8f0] mb-2">Password</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#3b82f6] transition-all" />
                      {authTab === 'login' && <div className="text-right mt-2"><a href="#" className="text-xs font-bold text-[#3b82f6] hover:underline">Forgot password?</a></div>}
                    </div>
                  </>
                )}

                {authTab === 'register' && step === 2 && (
                  <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                    <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white focus:outline-none focus:border-[#3b82f6]" /></div>
                    <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white focus:outline-none focus:border-[#3b82f6]" /></div>
                    <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Company</label><input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white focus:outline-none focus:border-[#3b82f6]" /></div>
                    <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Role / Job Title</label><input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-white focus:outline-none focus:border-[#3b82f6]" /></div>
                  </div>
                )}

                {error && <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg text-center">{error}</div>}

                <button type="submit" disabled={loading} className="w-full py-3.5 bg-[#3b82f6] text-white font-bold text-sm rounded-lg hover:bg-[#2563eb] disabled:opacity-50 transition-colors mt-4 shadow-lg shadow-blue-500/20">
                  {loading ? 'Please wait...' : authTab === 'login' ? 'Sign In' : (step === 1 ? 'Continue →' : 'Complete Registration')}
                </button>

                {authTab === 'register' && step === 2 && (
                  <button type="button" onClick={() => setStep(1)} className="w-full py-2.5 bg-transparent text-[#94a3b8] font-bold text-sm hover:text-white transition-colors">
                    ← Back
                  </button>
                )}

                <div className="mt-8 pt-6 border-t border-[#334155] text-center">
                  <p className="text-[#94a3b8] text-xs flex items-center justify-center gap-1.5 mb-2 font-bold">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    Enterprise Security
                  </p>
                  <p className="text-[#64748b] text-[10px] font-mono">AES-256 · MFA · SOC2</p>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f8fafc] font-sans flex flex-col relative overflow-x-hidden">
      
      <LightningBackground />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-8 py-6 max-w-[1400px] mx-auto w-full">
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <img src="/logo.png" alt="CloudyBro" className="w-9 h-9 group-hover:scale-110 transition-transform" />
          <span className="text-xl font-extrabold tracking-tight">CLOUDY<span className="text-[#3b82f6]">BRO</span></span>
        </div>

        <nav className="hidden md:flex items-center gap-8 bg-[#1e293b]/50 backdrop-blur-md px-6 py-2 rounded-full border border-[#334155]">
          <button onClick={() => setActiveTab('features')} className={`text-sm font-bold transition-colors ${activeTab === 'features' ? 'text-white' : 'text-[#94a3b8] hover:text-white'}`}>Features</button>
          <button onClick={() => setActiveTab('pricing')} className={`text-sm font-bold transition-colors ${activeTab === 'pricing' ? 'text-white' : 'text-[#94a3b8] hover:text-white'}`}>Pricing</button>
          <button onClick={() => setActiveTab('docs')} className={`text-sm font-bold transition-colors ${activeTab === 'docs' ? 'text-white' : 'text-[#94a3b8] hover:text-white'}`}>Docs</button>
        </nav>

        <div className="flex items-center gap-4">
          <button onClick={() => { setAuthTab('login'); setIsLoginOpen(true) }} className="text-sm font-bold text-white hover:text-[#3b82f6] transition-colors hidden sm:block">Login</button>
          <button onClick={() => { setAuthTab('register'); setIsLoginOpen(true) }} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-colors">Start Free</button>
        </div>
      </header>

      {/* Dynamic Content */}
      <main className="flex-1 flex flex-col items-center pt-10 px-6 z-10 w-full relative">
        {activeTab === 'home' && renderHomeContent()}
        {activeTab === 'features' && renderFeaturesContent()}
        {activeTab === 'pricing' && renderPricingContent()}
        {activeTab === 'docs' && renderDocsContent()}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#334155] bg-[#0f172a] mt-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-[#64748b] text-sm font-mono">&copy; 2026 CloudyBro. All rights reserved.</p>
          <div className="flex items-center gap-6 mt-4 md:mt-0 text-sm font-bold text-[#64748b]">
            <a href="#" className="hover:text-white transition-colors">Status</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {/* Sliding Login Drawer */}
      {renderLoginDrawer()}

    </div>
  )
}
