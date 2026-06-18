import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function Contact() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('Technical Support')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    if (!name || !email || !message) {
      alert('Please fill out all fields.')
      return
    }
    setSent(true)
    setTimeout(() => {
      alert('Transmission successfully sent!')
      setName('')
      setEmail('')
      setMessage('')
      setSent(false)
    }, 1000)
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md overflow-x-hidden relative">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px]"></div>
      </div>

      {/* TopNavBar */}
      <nav className="sticky top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-white/10 shadow-[0_0_20px_rgba(60,215,255,0.1)]">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <Link to="/login" className="flex items-center gap-2 cursor-pointer group">
            <img alt="CloudyBro Logo" className="h-8 w-8 object-contain group-hover:scale-110 transition-transform" src="/logo.png" />
            <span className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-primary-fixed-dim tracking-tighter">CloudyBro</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-2 rounded-lg duration-300" to="/login#features">Features</Link>
            <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-2 rounded-lg duration-300" to="/login#pricing">Pricing</Link>
            <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-2 rounded-lg duration-300" to="/login#docs">Docs</Link>
            <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-2 rounded-lg duration-300" to="/about">About Us</Link>
            <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-2 rounded-lg duration-300" to="/contact">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="hidden md:flex items-center justify-center bg-primary-container text-on-primary-container font-label-caps text-label-caps px-6 py-2 rounded-full hover:bg-primary-fixed transition-colors active:scale-95 glow-effect cursor-pointer"
            >
              Get Started Free
            </button>
            <button onClick={() => navigate('/login')} className="md:hidden text-on-surface-variant cursor-pointer">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="flex-grow z-10 relative px-margin-mobile md:px-margin-desktop py-12 md:py-24 max-w-container-max mx-auto w-full flex flex-col gap-16 md:gap-32">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-6 px-4">
          <h1 className="font-display-lg text-display-lg text-gradient leading-tight">Get in Touch with Command Center</h1>
          <p className="font-body-md text-body-md text-on-surface-variant text-lg">
            Establish a secure connection with our engineering team. Whether you're scaling a nebula or debugging a cosmic anomaly, we're on standby.
          </p>
        </section>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start px-4">
          {/* Contact Form (Left/Top) */}
          <section className="lg:col-span-7 glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none"></div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-8 text-left text-white">Secure Transmission</h2>
            <form className="space-y-6 relative z-10 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant block">Operative Name</label>
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface-container/50 border border-outline-variant/50 rounded-lg px-4 py-3 text-on-surface font-body-md focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all outline-none text-white" 
                    placeholder="Jane Doe" 
                    type="text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant block">Comm Link (Email)</label>
                  <input 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-container/50 border border-outline-variant/50 rounded-lg px-4 py-3 text-on-surface font-body-md focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all outline-none text-white" 
                    placeholder="jane@enterprise.com" 
                    type="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps text-on-surface-variant block">Subject Designation</label>
                <div className="relative">
                  <select 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-surface-container/50 border border-outline-variant/50 rounded-lg px-4 py-3 text-on-surface font-body-md focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all outline-none appearance-none text-white"
                  >
                    <option className="bg-[#051424]">Technical Support</option>
                    <option className="bg-[#051424]">Enterprise Architecture</option>
                    <option className="bg-[#051424]">Billing Inquiry</option>
                    <option className="bg-[#051424]">Partnership</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps text-on-surface-variant block">Encrypted Payload</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-surface-container/50 border border-outline-variant/50 rounded-lg px-4 py-3 text-on-surface font-body-md focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-all outline-none resize-none font-code-sm text-white" 
                  placeholder="Initialize sequence..." 
                  rows="5"
                ></textarea>
              </div>
              <button 
                onClick={handleSend}
                disabled={sent}
                className="w-full md:w-auto bg-primary-container text-on-primary-container font-label-caps text-label-caps px-8 py-4 rounded-full hover:bg-primary-fixed transition-all active:scale-95 glow-effect flex items-center justify-center gap-2 group/btn cursor-pointer" 
                type="button"
              >
                <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {sent ? 'Sending...' : 'Send Transmission'}
              </button>
            </form>
          </section>

          {/* Alternative Paths & Location (Right/Bottom) */}
          <div className="lg:col-span-5 space-y-8 text-left">
            {/* Alternative Support Paths */}
            <section className="space-y-4">
              <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-background text-white">Alternative Vectors</h3>
              <div className="grid grid-cols-1 gap-4">
                <Link className="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition-colors group" to="/login#docs">
                  <div className="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary-fixed-dim group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-primary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-background text-white">Documentation</h4>
                    <p className="font-label-caps text-label-caps text-on-surface-variant">Self-serve technical specs</p>
                  </div>
                </Link>
                <a className="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition-colors group" href="https://discord.com" target="_blank" rel="noreferrer">
                  <div className="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary-fixed-dim group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025 4.48 4.48 0 01-.815-.312C2.067 16.305 2 14.17 2 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-background text-white">Community Discord</h4>
                    <p className="font-label-caps text-label-caps text-on-surface-variant">Real-time peer support</p>
                  </div>
                </a>
                <a className="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition-colors group" href="mailto:enterprise@cloudybro.com">
                  <div className="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary-fixed group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m16.5-18v18m-18-18H21.75M12 3v18M4.5 9h3.75M15.75 9h3.75m-15 4.5h3.75m11.25 0h3.75" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-background text-white">Enterprise Support</h4>
                    <p className="font-label-caps text-label-caps text-on-surface-variant">SLA-backed direct line</p>
                  </div>
                </a>
              </div>
            </section>

            {/* Location Map */}
            <section className="glass-panel rounded-2xl overflow-hidden relative h-64 border border-outline-variant/30">
              <div className="absolute inset-0 bg-surface-container-low/85 z-10 flex flex-col justify-end p-6">
                <div className="bg-surface/90 backdrop-blur-md border border-white/10 p-4 rounded-xl inline-block max-w-[250px] text-left">
                  <h4 className="font-label-caps text-label-caps text-primary-fixed-dim mb-1 flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Based in the Cloud
                  </h4>
                  <p className="font-code-sm text-code-sm text-on-surface-variant">San Francisco HQ<br/>Terminal 4, Level 9</p>
                </div>
              </div>
              {/* Map Placeholder Image */}
              <div className="absolute inset-0 bg-cover bg-center opacity-70 mix-blend-screen z-0" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDCWMp4TaC2VxVFFB8dzOAbqaY6Qatk1BzScz9WW7Qgr-8GhHrt4pGNIn65v7yU86NzFezBTui59GwZG1duc4FrzbdAOoBN-GN04_VGJw3lxoT1Xr2m9ekyPoDNDUS7epc0ZH3unU7HTvdq3BU3HLBR1F60Q6zF2jJGtIRpWbsM4zliIDph5mupHh4OcGed4odaaVk_o54sL3Vve9MBr4yzRqt59VofN0ubdSaX4IPgOpXd7XNI74Pi')" }}></div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-dim border-t border-outline-variant/30 w-full py-12 z-10 relative">
        <div className="max-w-container-max mx-auto px-margin-desktop grid grid-cols-2 md:grid-cols-4 gap-gutter text-left">
          <div className="col-span-2 md:col-span-1 mb-8 md:mb-0">
            <span className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary-fixed block mb-4">CloudyBro</span>
            <p className="font-body-md text-body-md text-secondary">© 2026 CloudyBro Inc. Engineering the Nebula.</p>
          </div>
          {/* Links */}
          <div className="flex flex-col gap-3">
            <Link className="text-on-surface-variant hover:text-surface-tint transition-colors text-sm" to="/login#features">Product</Link>
            <a className="text-on-surface-variant hover:text-surface-tint transition-colors text-sm" href="#">Network</a>
          </div>
          <div className="flex flex-col gap-3">
            <a className="text-on-surface-variant hover:text-surface-tint transition-colors text-sm" href="#">Security</a>
            <a className="text-on-surface-variant hover:text-surface-tint transition-colors text-sm" href="#">Terms</a>
          </div>
          <div className="flex flex-col gap-3">
            <a className="text-on-surface-variant hover:text-surface-tint transition-colors text-sm" href="#">Privacy</a>
            <Link className="text-on-surface-variant hover:text-surface-tint transition-colors text-sm" to="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
