import { Link, useNavigate } from 'react-router-dom'

export default function About() {
  const navigate = useNavigate()

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md relative overflow-x-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg z-0 pointer-events-none">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
      </div>

      {/* TopNavBar */}
      <nav className="bg-surface/80 backdrop-blur-xl sticky top-0 w-full z-50 border-b border-white/10 shadow-[0_0_20px_rgba(60,215,255,0.1)]">
        <div className="flex justify-between items-center px-margin-desktop py-4 max-w-container-max mx-auto">
          {/* Brand */}
          <Link to="/login" className="flex items-center gap-4 cursor-pointer group">
            <img alt="CloudyBro Logo" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform" src="/logo.png" />
            <span className="font-headline-lg text-headline-lg font-bold text-primary-fixed-dim tracking-tighter">CloudyBro</span>
          </Link>

          {/* Links (Desktop) */}
          <div className="hidden md:flex gap-8">
            <Link className="text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-1 rounded-DEFAULT duration-300" to="/login#features">Features</Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-1 rounded-DEFAULT duration-300" to="/login#pricing">Pricing</Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-1 rounded-DEFAULT duration-300" to="/login#docs">Docs</Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-1 rounded-DEFAULT duration-300" to="/about">About Us</Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 px-3 py-1 rounded-DEFAULT duration-300" to="/contact">Contact</Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex relative text-on-surface-variant focus-within:text-primary-container">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input className="bg-surface-container border border-outline-variant/50 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all glass-panel w-48 text-white placeholder-outline" placeholder="Search..." type="text"/>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-bold active:scale-95 transition-transform hover:shadow-[0_0_15px_rgba(0,212,255,0.4)] cursor-pointer"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center w-full px-margin-mobile md:px-margin-desktop py-12 md:py-24 gap-24 relative z-10">
        {/* Hero Section */}
        <section className="max-w-3xl w-full flex flex-col items-center text-center gap-6 mt-12 px-4">
          <h1 className="font-display-lg text-display-lg text-on-surface max-w-4xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-fixed to-secondary-fixed">
            Engineering the Future of Cloud Operations
          </h1>
          <p className="text-on-surface-variant text-lg md:text-xl max-w-2xl">
            Our mission is to put DevOps on autopilot, eliminating alert fatigue and empowering engineering teams to focus on innovation.
          </p>
        </section>

        {/* Our Story (Glass Panel) */}
        <section className="max-w-4xl w-full glass-panel rounded-xl p-8 md:p-12 relative overflow-hidden group mx-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform duration-1000 group-hover:scale-150"></div>
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-secondary-fixed">
              <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-white">Our Story</h2>
            </div>
            <div className="space-y-4 text-on-surface-variant text-left leading-relaxed">
              <p>
                CloudyBro was born out of frustration. Our founders, veterans of high-scale SRE teams, were drowning in a sea of meaningless alerts, disconnected dashboards, and manual remediation runbooks. We realized that existing monitoring tools were designed to show you what was broken, not fix it.
              </p>
              <p>
                We set out to build a platform that doesn't just observe, but acts. By combining deep infrastructure context with deterministic automation, we created a system that understands the 'why' behind an alert and automatically executes the 'how' to resolve it.
              </p>
            </div>
          </div>
        </section>

        {/* Our Values */}
        <section className="max-w-container-max w-full flex flex-col gap-12 px-4">
          <div className="text-center">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface mb-2">Core Values</h2>
            <p className="text-on-surface-variant">The principles that drive our engineering.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Value 1 */}
            <div className="glass-panel rounded-lg p-8 flex flex-col gap-4 items-start glow-hover transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-primary-container mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-on-surface text-lg text-white">Precision</h3>
              <p className="text-on-surface-variant text-sm text-left leading-relaxed">Signal over noise. We believe in actionable intelligence, stripping away irrelevant data to focus on root causes with pinpoint accuracy.</p>
            </div>
            {/* Value 2 */}
            <div className="glass-panel rounded-lg p-8 flex flex-col gap-4 items-start glow-hover transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-secondary mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25M19.5 3H4.5A1.5 1.5 0 003 4.5v.75a1.5 1.5 0 001.5 1.5h15A1.5 1.5 0 0021 5.25v-.75A1.5 1.5 0 0019.5 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-on-surface text-lg text-white">Automation</h3>
              <p className="text-on-surface-variant text-sm text-left leading-relaxed">If it can be codified, it should be automated. We build systems that resolve issues before a human operator even receives a pager notification.</p>
            </div>
            {/* Value 3 */}
            <div className="glass-panel rounded-lg p-8 flex flex-col gap-4 items-start glow-hover transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-error mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="font-bold text-on-surface text-lg text-white">Security</h3>
              <p className="text-on-surface-variant text-sm text-left leading-relaxed">Security is not an afterthought; it's the foundation. Every automated action and data transfer is cryptographically verified and strictly audited.</p>
            </div>
          </div>
        </section>

        {/* Meet the Team */}
        <section className="max-w-container-max w-full flex flex-col gap-12 px-4">
          <div className="flex flex-col gap-2 text-left">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">The Engineers</h2>
            <div className="h-px w-full bg-gradient-to-r from-primary-container/50 to-transparent"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Team Member 1 */}
            <div className="glass-panel rounded-lg p-6 flex flex-col items-center text-center gap-4 group">
              <div className="w-20 h-20 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center group-hover:border-primary transition-colors overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-container/20 to-transparent"></div>
                <svg className="w-8 h-8 text-on-surface-variant z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-on-surface text-white">Lead Architect</h4>
                <p className="text-xs font-code-sm text-code-sm text-primary-fixed-dim mt-1">SRE Core</p>
              </div>
            </div>
            {/* Team Member 2 */}
            <div className="glass-panel rounded-lg p-6 flex flex-col items-center text-center gap-4 group">
              <div className="w-20 h-20 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center group-hover:border-secondary transition-colors overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-transparent"></div>
                <svg className="w-8 h-8 text-on-surface-variant z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-on-surface text-white">Infra Specialist</h4>
                <p className="text-xs font-code-sm text-code-sm text-secondary-fixed-dim mt-1">Platform</p>
              </div>
            </div>
            {/* Team Member 3 */}
            <div className="glass-panel rounded-lg p-6 flex flex-col items-center text-center gap-4 group">
              <div className="w-20 h-20 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center group-hover:border-primary transition-colors overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
                <svg className="w-8 h-8 text-on-surface-variant z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-on-surface text-white">Automation Eng</h4>
                <p className="text-xs font-code-sm text-code-sm text-primary-fixed-dim mt-1">Control Plane</p>
              </div>
            </div>
            {/* Team Member 4 */}
            <div className="glass-panel rounded-lg p-6 flex flex-col items-center text-center gap-4 group">
              <div className="w-20 h-20 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center group-hover:border-secondary transition-colors overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-transparent"></div>
                <svg className="w-8 h-8 text-on-surface-variant z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.956 11.956 0 0112 2.714z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-on-surface text-white">Security Lead</h4>
                <p className="text-xs font-code-sm text-code-sm text-secondary-fixed-dim mt-1">SecOps</p>
              </div>
            </div>
          </div>
        </section>

        {/* Vision */}
        <section className="max-w-4xl w-full text-center py-12 md:py-24 border-t border-outline-variant/30 mt-12 relative px-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-container/10 via-transparent to-transparent blur-2xl -z-10"></div>
          <h2 className="font-display-lg text-display-lg text-on-surface italic tracking-tight text-white">
            "A world where infrastructure <span className="text-primary-container">heals itself</span>."
          </h2>
        </section>
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
