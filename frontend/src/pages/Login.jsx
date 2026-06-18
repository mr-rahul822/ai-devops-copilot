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
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash || ''
    if (hash === '#features') return 'features'
    if (hash === '#pricing') return 'pricing'
    if (hash === '#docs') return 'docs'
    return 'home'
  })

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || ''
      if (hash === '#features') setActiveTab('features')
      else if (hash === '#pricing') setActiveTab('pricing')
      else if (hash === '#docs') setActiveTab('docs')
      else if (hash === '#home' || !hash) setActiveTab('home')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState({ type: '', text: '' })

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

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setForgotMsg({ type: 'error', text: 'Please enter your email.' })
      return
    }
    setForgotLoading(true)
    setForgotMsg({ type: '', text: '' })
    try {
      const { forgotPassword } = await import('../api/auth')
      await forgotPassword(forgotEmail)
      setForgotMsg({ type: 'success', text: 'If an account exists with this email, a reset link has been sent. Check your console in development mode.' })
    } catch (err) {
      setForgotMsg({ type: 'error', text: err?.response?.data?.error || 'Something went wrong.' })
    } finally {
      setForgotLoading(false)
    }
  }

  // ── Main Content Components ──────────────────────────────────────────────

  // ── Main Content Components ──────────────────────────────────────────────

  const HomeContent = () => (
    <div className="w-full flex flex-col items-center">
      <div className="max-w-container-max mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-20 pb-20 px-4 w-full">
        {/* Hero Content */}
        <div className="flex flex-col gap-8 z-10 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel w-fit">
            <span className="w-2 h-2 rounded-full bg-surface-tint animate-pulse"></span>
            <span className="font-code-sm text-code-sm text-surface-tint">v2.0 Beta Live</span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface">
            DevOps on <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary-container">Autopilot</span>
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-lg text-lg">
            AI-driven monitoring, instant incident remediation, and autonomous infrastructure optimization. Take command of your systems without writing another script.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button 
              onClick={() => { setAuthTab('register'); setIsLoginOpen(true) }}
              className="px-8 py-3 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold glow-primary transition-all hover:scale-105 cursor-pointer"
            >
              Start for Free
            </button>
            <button className="px-8 py-3 rounded-full glass-panel text-on-surface font-label-caps text-label-caps hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
              Watch Demo
            </button>
          </div>
        </div>

        {/* Hero Visual (Terminal Mockup) */}
        <div className="z-10 relative">
          <div className="glass-panel rounded-24px p-1 glow-primary transform hover:scale-[1.01] transition-transform duration-700 ease-out">
            <div className="rounded-[22px] terminal-bg overflow-hidden border border-white/5 shadow-2xl">
              {/* Terminal Header */}
              <div className="bg-surface-variant/50 px-4 py-2 border-b border-white/10 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-error"></div>
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                </div>
                <div className="flex-1 text-center font-code-sm text-code-sm text-on-surface-variant/70">
                  cloudybro@cluster-alpha:~
                </div>
              </div>
              {/* Terminal Body */}
              <div className="p-6 font-code-sm text-code-sm flex flex-col gap-3 min-h-[300px] text-left">
                <div className="text-on-surface-variant">
                  <span className="text-surface-tint">❯</span> analyzing load spikes...
                </div>
                <div className="text-on-surface-variant">
                  <span className="text-surface-tint">❯</span> detecting anomaly in us-east-1...
                </div>
                <div className="text-primary mt-2 font-semibold">
                  [ALERT] CPU usage &gt; 90% on api-gateway-03
                </div>
                <div className="text-on-surface-variant mt-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-surface-tint animate-spin" style={{ fontSize: '16px' }}>autorenew</span>
                  AI Agent initiating auto-scaling...
                </div>
                <div className="text-[#10b981] mt-2 font-semibold">
                  ✓ Provisioned 2 new instances successfully.
                </div>
                <div className="text-[#10b981] font-semibold">
                  ✓ Traffic re-routed. System stable. Time to resolve: 1.2s.
                </div>
                <div className="text-surface-tint mt-4 animate-pulse">_</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Bar */}
      <div className="w-full py-12 border-y border-white/5 bg-surface-dim/50 mt-10">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="font-headline-lg text-headline-lg-mobile text-on-surface-variant font-bold tracking-tighter">AWS</div>
          <div className="font-headline-lg text-headline-lg-mobile text-on-surface-variant font-bold tracking-tighter">GitHub</div>
          <div className="font-headline-lg text-headline-lg-mobile text-on-surface-variant font-bold tracking-tighter">Docker</div>
          <div className="font-headline-lg text-headline-lg-mobile text-on-surface-variant font-bold tracking-tighter">Kubernetes</div>
          <div className="font-headline-lg text-headline-lg-mobile text-on-surface-variant font-bold tracking-tighter">Terraform</div>
        </div>
      </div>
    </div>
  )

  const FeaturesContent = () => (
    <div className="max-w-container-max mx-auto w-full pt-10 pb-20 px-4">
      <div className="text-center mb-16">
        <h2 className="font-display-lg text-headline-lg md:text-display-lg text-on-surface mb-4">Command your Infrastructure</h2>
        <p className="font-body-md text-on-surface-variant max-w-2xl mx-auto">Intelligent tools designed to anticipate failures before they happen.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Feature 1 */}
        <div className="glass-panel p-8 rounded-24px hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-surface-tint">smart_toy</span>
          </div>
          <h3 className="font-headline-lg text-[24px] text-on-surface mb-3 text-left">AI Root Cause</h3>
          <p className="font-body-md text-on-surface-variant text-left">Instantly trace complex microservice failures down to the exact commit that broke the build.</p>
        </div>
        {/* Feature 2 */}
        <div className="glass-panel p-8 rounded-24px hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-secondary">cloud_sync</span>
          </div>
          <h3 className="font-headline-lg text-[24px] text-on-surface mb-3 text-left">Multi-Cloud Sync</h3>
          <p className="font-body-md text-on-surface-variant text-left">Unified visibility across AWS, GCP, and Azure with zero configuration required.</p>
        </div>
        {/* Feature 3 */}
        <div className="glass-panel p-8 rounded-24px hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-surface-tint">monitoring</span>
          </div>
          <h3 className="font-headline-lg text-[24px] text-on-surface mb-3 text-left">Predictive Metrics</h3>
          <p className="font-body-md text-on-surface-variant text-left">Forecast resource exhaustion days before it impacts your end-users.</p>
        </div>
        {/* Feature 4 */}
        <div className="glass-panel p-8 rounded-24px hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-secondary">notifications_active</span>
          </div>
          <h3 className="font-headline-lg text-[24px] text-on-surface mb-3 text-left">Smart Alerts</h3>
          <p className="font-body-md text-on-surface-variant text-left">Reduce alert fatigue. Only get notified when human intervention is actually required.</p>
        </div>
        {/* Feature 5 */}
        <div className="glass-panel p-8 rounded-24px hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-surface-tint">build</span>
          </div>
          <h3 className="font-headline-lg text-[24px] text-on-surface mb-3 text-left">Auto-Remediation</h3>
          <p className="font-body-md text-on-surface-variant text-left">Define self-healing policies that execute standard operating procedures automatically.</p>
        </div>
        {/* Feature 6 */}
        <div className="glass-panel p-8 rounded-24px hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-secondary">security</span>
          </div>
          <h3 className="font-headline-lg text-[24px] text-on-surface mb-3 text-left">Shift-Left Security</h3>
          <p className="font-body-md text-on-surface-variant text-left">Continuous vulnerability scanning embedded directly into your CI/CD pipelines.</p>
        </div>
      </div>
    </div>
  )

  const PricingContent = () => (
    <div className="max-w-container-max mx-auto w-full pt-10 pb-20 px-4">
      <div className="text-center mb-16">
        <h2 className="font-display-lg text-headline-lg md:text-display-lg text-on-surface mb-4">Simple, Transparent Pricing</h2>
        <p className="font-body-md text-on-surface-variant max-w-2xl mx-auto">Scale your infrastructure without scaling your costs exponentially.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
        {/* Starter Tier */}
        <div className="glass-panel p-8 rounded-24px flex flex-col h-full text-left">
          <div className="mb-8">
            <h3 className="font-headline-lg text-[24px] text-on-surface mb-2">Starter</h3>
            <div className="text-on-surface-variant text-sm mb-4">Perfect for hobby projects.</div>
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-4xl text-on-surface">$0</span>
              <span className="text-on-surface-variant">/mo</span>
            </div>
          </div>
          <ul className="flex flex-col gap-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              1 Cluster limit
            </li>
            <li className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Basic metrics
            </li>
            <li className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Community support
            </li>
          </ul>
          <button 
            onClick={() => { setAuthTab('register'); setIsLoginOpen(true) }}
            className="w-full py-3 rounded-full border border-white/20 text-on-surface font-label-caps text-label-caps hover:bg-white/5 transition-all cursor-pointer"
          >
            Get Started
          </button>
        </div>

        {/* Pro Tier (Highlighted) */}
        <div className="glass-panel p-8 rounded-24px flex flex-col h-full border-surface-tint/50 glow-primary transform md:-translate-y-4 bg-surface-container-low/80 relative text-left">
          <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
            Most Popular
          </div>
          <div className="mb-8">
            <h3 className="font-headline-lg text-[24px] text-on-surface mb-2">Pro</h3>
            <div className="text-on-surface-variant text-sm mb-4">For production workloads.</div>
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-4xl text-on-surface">$29</span>
              <span className="text-on-surface-variant">/mo</span>
            </div>
          </div>
          <ul className="flex flex-col gap-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Unlimited Clusters
            </li>
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              AI Auto-remediation
            </li>
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Advanced Alerts
            </li>
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Priority Support
            </li>
          </ul>
          <button 
            onClick={() => { setAuthTab('register'); setIsLoginOpen(true) }}
            className="w-full py-3 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold transition-all hover:scale-105 cursor-pointer"
          >
            Start 14-Day Trial
          </button>
        </div>

        {/* Enterprise Tier */}
        <div className="glass-panel p-8 rounded-24px flex flex-col h-full text-left">
          <div className="mb-8">
            <h3 className="font-headline-lg text-[24px] text-on-surface mb-2">Enterprise</h3>
            <div className="text-on-surface-variant text-sm mb-4">Custom needs &amp; compliance.</div>
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-4xl text-on-surface">Custom</span>
            </div>
          </div>
          <ul className="flex flex-col gap-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              SSO &amp; SAML
            </li>
            <li className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Dedicated Instance
            </li>
            <li className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-surface-tint text-sm">check</span>
              Custom Models
            </li>
          </ul>
          <button 
            onClick={() => { setAuthTab('register'); setIsLoginOpen(true) }}
            className="w-full py-3 rounded-full border border-white/20 text-on-surface font-label-caps text-label-caps hover:bg-white/5 transition-all cursor-pointer"
          >
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  )

  const DocsContent = () => (
    <div className="max-w-3xl mx-auto w-full pt-10 pb-20 px-4 text-left">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-extrabold text-white mb-4">Frequently Asked Questions</h2>
        <p className="text-[#94a3b8] text-lg">Everything you need to know about Cloudy Bro.</p>
      </div>

      <div className="space-y-4">
        {[
          { q: "How does Cloudy Bro access my metrics?", a: "We provide lightweight, open-source agents (Cloudy Bro Collectors) that run securely within your environment. They push telemetry out to our ingestion endpoints. We do not require inbound firewall access to your servers." },
          { q: "Is the AI analysis secure?", a: "Yes. Telemetry sent to the Claude API is fully anonymized. We strip all PII, secrets, and environment variables before passing logs to the AI engine." },
          { q: "Can I self-host the platform?", a: "Yes. Cloudy Bro is designed as a microservices architecture using Docker Compose. Enterprise customers can deploy the entire stack on their own air-gapped infrastructure." },
          { q: "How do Auto-Healing Playbooks work?", a: "Playbooks are strict, pre-approved scripts (like restarting a pod or clearing a tmp folder). The AI recommends an action, but it requires explicit approval unless you configure an automated rule." }
        ].map((faq, i) => (
          <div key={i} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
            <p className="text-[#94a3b8] leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Login Drawer Component ───────────────────────────────────────────────

  const LoginDrawer = () => (
    <>
      {/* Backdrop */}
      {isLoginOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-[fadeIn_0.3s_ease-out]"
          onClick={() => setIsLoginOpen(false)}
        ></div>
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-surface-dim/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto ${isLoginOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        <button
          onClick={() => setIsLoginOpen(false)}
          className="absolute top-6 right-6 p-2 text-[#94a3b8] hover:text-white bg-[#1e293b] rounded-full transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-8 sm:p-12 min-h-full flex flex-col justify-center">

          <div className="flex flex-col items-center justify-center mb-10">
            {/* Enlarged Logo here */}
            <div className="bg-surface-container border border-white/10 p-4 rounded-2xl shadow-lg mb-6">
              <img src="/logo.png" alt="Cloudy Bro" className="w-16 h-16 object-contain" />
            </div>
            <h2 className="text-2xl mb-1 font-extrabold text-white tracking-tight text-center">
              {mfaRequired ? 'Two-Factor Auth' : authTab === 'forgot' ? 'Reset Password' : authTab === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-[#94a3b8] text-sm text-center">
              {mfaRequired ? (!useBackup ? "Enter the 6-digit code from your authenticator app" : "Enter one of your backup codes") :
                authTab === 'forgot' ? 'Enter your email and we\'ll send a reset link.' :
                authTab === 'login' ? 'Sign in to your Cloudy Bro control plane' :
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
                      className="w-12 h-14 text-center text-xl font-bold rounded-lg bg-surface-container-lowest border border-white/10 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  ))}
                </div>
              ) : (
                <input
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="e.g., a1b2c3d4"
                  className="w-full px-4 py-3.5 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white mb-8 text-center font-mono text-lg focus:outline-none focus:border-primary transition-all"
                />
              )}

              {error && <div className="bg-error-container/30 border border-error-container text-error text-sm px-4 py-3 rounded-lg mb-6 text-center">{error}</div>}

              <button
                onClick={handleMfaSubmit}
                disabled={loading}
                className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold rounded-lg transition-all hover:scale-102 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] duration-200 mb-6"
              >
                {loading ? 'Verifying...' : 'Verify →'}
              </button>

              <div className="flex justify-between text-sm">
                <button onClick={() => { setUseBackup(!useBackup); setError('') }} className="text-primary hover:underline bg-transparent font-medium cursor-pointer">
                  {useBackup ? 'Use authenticator code' : 'Use a backup code instead'}
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-[fadeIn_0.3s_ease-out]">

              {authTab === 'forgot' ? (
                <div className="space-y-5">
                  {forgotMsg.text && (
                    <div className={`p-3 rounded-lg text-[13px] ${forgotMsg.type === 'success' ? 'bg-green-900/20 border border-green-800 text-green-400' : 'bg-error-container/30 border border-error-container text-error'}`}>
                      {forgotMsg.text}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-[#e2e8f0] mb-2">Email address</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-4 py-3 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white placeholder-outline focus:outline-none focus:border-primary transition-all"
                    />
                  </div>

                  <button
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold rounded-lg transition-all hover:scale-102 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] duration-200"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <button
                    onClick={() => { setAuthTab('login'); setForgotMsg({ type: '', text: '' }) }}
                    className="w-full text-[13px] text-[#94a3b8] hover:text-white bg-transparent font-medium transition-colors cursor-pointer"
                  >
                    ← Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex border-b border-white/10 mb-8 bg-surface-container-low rounded-t-lg">
                    <button
                      id="tab-login"
                      onClick={() => { setAuthTab('login'); setStep(1); setError('') }}
                      className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${authTab === 'login' ? 'text-primary border-primary' : 'text-on-surface-variant hover:text-white border-transparent'
                        }`}
                    >
                      Login
                    </button>
                    <button
                      id="tab-register"
                      onClick={() => { setAuthTab('register'); setError('') }}
                      className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${authTab === 'register' ? 'text-primary border-primary' : 'text-on-surface-variant hover:text-white border-transparent'
                        }`}
                    >
                      Register
                    </button>
                  </div>

                  <form noValidate onSubmit={authTab === 'login' ? handleSubmit : (step === 1 ? handleNextStep : handleSubmit)} className="space-y-5">
                    {(authTab === 'login' || (authTab === 'register' && step === 1)) && (
                      <>
                        <div>
                          <label className="block text-sm font-bold text-[#e2e8f0] mb-2">Email address</label>
                          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="w-full px-4 py-3 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white placeholder-outline focus:outline-none focus:border-primary transition-all" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-[#e2e8f0] mb-2">Password</label>
                          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white placeholder-outline focus:outline-none focus:border-primary transition-all" />
                          {authTab === 'login' && <div className="text-right mt-2"><button type="button" onClick={() => { setAuthTab('forgot'); setForgotEmail(email); setError('') }} className="text-xs font-bold text-primary hover:underline bg-transparent cursor-pointer">Forgot password?</button></div>}
                        </div>
                      </>
                    )}

                    {authTab === 'register' && step === 2 && (
                      <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                        <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Full Name</label><input id="register-fullname" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary" /></div>
                        <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Phone Number</label><input id="register-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary" /></div>
                        <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Company</label><input id="register-company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-4 py-2.5 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary" /></div>
                        <div><label className="block text-sm font-bold text-[#e2e8f0] mb-1.5">Role / Job Title</label><input id="register-jobtitle" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full px-4 py-2.5 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary" /></div>
                      </div>
                    )}

                    {error && <div className="bg-error-container/30 border border-error-container text-error text-sm px-4 py-3 rounded-lg text-center">{error}</div>}

                    <button id="auth-submit-button" type="submit" disabled={loading} className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold rounded-lg transition-all hover:scale-102 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] duration-200 mt-4 cursor-pointer">
                      {loading ? 'Please wait...' : authTab === 'login' ? 'Sign In' : (step === 1 ? 'Continue →' : 'Complete Registration')}
                    </button>

                    {authTab === 'register' && step === 2 && (
                      <button id="auth-back-button" type="button" onClick={() => setStep(1)} className="w-full py-2.5 bg-transparent text-[#94a3b8] font-bold text-sm hover:text-white transition-colors cursor-pointer">
                        ← Back
                      </button>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                      <p className="text-[#94a3b8] text-xs flex items-center justify-center gap-1.5 mb-2 font-bold">
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        Enterprise Security
                      </p>
                      <p className="text-outline-variant text-[10px] font-mono">AES-256 · MFA · SOC2</p>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md text-body-md selection:bg-primary-container selection:text-on-primary-container relative overflow-x-hidden flex flex-col">
      {/* Background decoration */}
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#051424]"></div>

      {/* Navigation */}
      <nav className="bg-background/80 backdrop-blur-xl top-0 sticky z-30 border-b border-white/10 shadow-[0px_0px_20px_rgba(60,215,255,0.1)]">
        <div className="flex justify-between items-center px-margin-desktop py-4 max-w-container-max mx-auto">
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <img alt="CloudyBro Logo" className="h-8 w-8 object-contain group-hover:scale-110 transition-transform" src="/logo.png" />
            <span className="text-headline-lg font-headline-lg text-on-surface font-bold tracking-tight">CloudyBro</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => setActiveTab('features')}
              className={`transition-colors duration-300 font-label-caps text-label-caps cursor-pointer ${
                activeTab === 'features' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Features
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`transition-colors duration-300 font-label-caps text-label-caps cursor-pointer ${
                activeTab === 'pricing' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Pricing
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`transition-colors duration-300 font-label-caps text-label-caps cursor-pointer ${
                activeTab === 'docs' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Docs
            </button>
            <button
              onClick={() => { setAuthTab('login'); setIsLoginOpen(true) }}
              className="text-on-surface-variant hover:text-primary transition-colors duration-300 font-label-caps text-label-caps cursor-pointer"
            >
              Login
            </button>
          </div>
          <div>
            <button
              onClick={() => { setAuthTab('register'); setIsLoginOpen(true) }}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold glow-primary transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full relative z-10 flex flex-col items-center pt-10 px-6">
        {activeTab === 'home' && HomeContent()}
        {activeTab === 'features' && FeaturesContent()}
        {activeTab === 'pricing' && PricingContent()}
        {activeTab === 'docs' && DocsContent()}
      </main>

      {/* Footer */}
      <footer className="bg-surface-dim full-width py-12 border-t border-outline-variant mt-20">
        <div className="max-w-container-max mx-auto px-margin-desktop grid grid-cols-1 md:grid-cols-4 gap-gutter text-left">
          <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <img alt="CloudyBro Logo" className="h-6 w-6 object-contain" src="/logo.png" />
              <span className="text-headline-lg font-headline-lg text-on-surface font-bold text-xl">CloudyBro</span>
            </div>
            <p className="text-on-surface-variant font-body-md text-sm max-w-sm">
              Your AI Copilot for DevOps. Automating the unglamorous parts of infrastructure management so you can focus on building.
            </p>
            <div className="mt-4 text-xs text-on-surface-variant/50 flex items-center gap-1.5">
              Made with 
              <span className="text-error inline-flex items-center">
                <svg className="w-3.5 h-3.5 fill-current text-red-500" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </span> 
              for DevOps engineers
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-label-caps text-label-caps text-on-surface font-semibold mb-2">Product</span>
            <button onClick={() => setActiveTab('features')} className="text-left text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline cursor-pointer">Features</button>
            <a className="text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline" href="#">Security</a>
            <button onClick={() => setActiveTab('pricing')} className="text-left text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline cursor-pointer">Pricing</button>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-label-caps text-label-caps text-on-surface font-semibold mb-2">Legal &amp; Social</span>
            <a className="text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline" href="#">Privacy Policy</a>
            <a className="text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline" href="#">Terms of Service</a>
            <a className="text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline" href="#">Twitter</a>
            <a className="text-on-surface-variant font-body-md text-sm hover:text-primary-fixed transition-colors hover:underline" href="https://github.com">GitHub</a>
          </div>
        </div>
        <div className="max-w-container-max mx-auto px-margin-desktop mt-12 pt-6 border-t border-white/5 text-center text-xs text-on-surface-variant/50">
          © 2026 CloudyBro AI. All rights reserved.
        </div>
      </footer>

      {/* Sliding Login Drawer */}
      {LoginDrawer()}
    </div>
  )
}
