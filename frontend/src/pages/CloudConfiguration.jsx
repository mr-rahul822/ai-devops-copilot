import { useState, useEffect, useCallback } from 'react'
import { connectCloud, getCloudStatus, disconnectCloud, getCloudInstances } from '../api/metrics'
import { useNavigate } from 'react-router-dom'

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
]

const CONNECT_STEPS = [
  { key: 'validate_credentials', label: 'Validating credentials' },
  { key: 'check_permissions', label: 'Checking permissions' },
  { key: 'discover_instances', label: 'Discovering EC2 instances' },
  { key: 'check_agent', label: 'Checking monitoring agent' },
  { key: 'setup_agent', label: 'Setting up monitoring agent' },
  { key: 'save_credentials', label: 'Saving credentials securely' },
  { key: 'start_monitoring', label: 'Starting metrics collection' },
]

export default function CloudConfiguration() {
  const navigate = useNavigate()
  const [wizardState, setWizardState] = useState('loading') // loading | disconnected | form | connecting | connected
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [showSecret, setShowSecret] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [error, setError] = useState('')
  const [connectResult, setConnectResult] = useState(null)
  const [completedSteps, setCompletedSteps] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [instances, setInstances] = useState([])
  const [statusData, setStatusData] = useState(null)

  // Check status on mount
  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const res = await getCloudStatus()
      const aws = res.data?.aws
      if (aws?.connected) {
        setStatusData(aws)
        setWizardState('connected')
        loadInstances()
      } else {
        setWizardState('disconnected')
      }
    } catch {
      setWizardState('disconnected')
    }
  }

  const loadInstances = async () => {
    try {
      const res = await getCloudInstances()
      setInstances(res.data?.instances || [])
    } catch { /* ignore */ }
  }

  const handleConnect = async () => {
    setError('')
    if (!accessKey.trim() || !secretKey.trim()) {
      setError('Please enter both your Access Key ID and Secret Access Key.')
      return
    }
    setWizardState('connecting')
    setCompletedSteps([])
    setCurrentStep(0)

    // Simulate progressive steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < CONNECT_STEPS.length - 1) return prev + 1
        clearInterval(stepInterval)
        return prev
      })
    }, 2500)

    try {
      const res = await connectCloud({
        provider: 'aws',
        access_key: accessKey.trim(),
        secret_key: secretKey.trim(),
        region,
      })
      clearInterval(stepInterval)
      setCompletedSteps(CONNECT_STEPS.map(s => s.key))
      setCurrentStep(CONNECT_STEPS.length)
      setConnectResult(res.data)
      setStatusData({ connected: true, account_id: res.data.account_id, region: res.data.region, instances: res.data.instances_discovered?.length || 0 })
      setInstances(res.data.instances_discovered || [])
      setTimeout(() => setWizardState('connected'), 1200)
    } catch (err) {
      clearInterval(stepInterval)
      const detail = err?.response?.data?.detail || 'Connection failed. Please check your credentials and try again.'
      setError(detail)
      setWizardState('form')
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your AWS account?')) return
    try {
      await disconnectCloud({ provider: 'aws' })
      setWizardState('disconnected')
      setStatusData(null)
      setInstances([])
      setAccessKey('')
      setSecretKey('')
      setConnectResult(null)
    } catch {
      setError('Failed to disconnect. Please try again.')
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Cloud Configuration</h1>
        <p className="text-[13px] text-[#64748b] mt-1">Connect your cloud provider to start monitoring infrastructure.</p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ProviderCard provider="AWS" color="#ff9900" connected={wizardState === 'connected'}
          onAction={() => wizardState === 'connected' ? null : setWizardState('form')}
          actionLabel={wizardState === 'connected' ? '✓ Connected' : 'Connect'}
          status={wizardState === 'connected' ? 'Connected' : 'Not connected'} />
        <ProviderCard provider="Azure" color="#0078d4" connected={false} actionLabel="Coming Soon" disabled status="Not connected" />
        <ProviderCard provider="GCP" color="#ea4335" connected={false} actionLabel="Coming Soon" disabled status="Not connected" />
      </div>

      {/* Wizard Content */}
      {wizardState === 'form' && (
        <FormState accessKey={accessKey} setAccessKey={setAccessKey} secretKey={secretKey} setSecretKey={setSecretKey}
          region={region} setRegion={setRegion} showSecret={showSecret} setShowSecret={setShowSecret}
          showGuide={showGuide} setShowGuide={setShowGuide} error={error} onConnect={handleConnect}
          onCancel={() => { setWizardState('disconnected'); setError('') }} />
      )}

      {wizardState === 'connecting' && (
        <ConnectingState steps={CONNECT_STEPS} currentStep={currentStep} completedSteps={completedSteps} />
      )}

      {wizardState === 'connected' && (
        <ConnectedState statusData={statusData} instances={instances} onDisconnect={handleDisconnect}
          onViewDashboard={() => navigate('/')} onRefresh={loadInstances} />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ProviderCard({ provider, color, connected, onAction, actionLabel, disabled, status }) {
  return (
    <div className={`bg-white rounded-lg border ${connected ? 'border-green-300 ring-1 ring-green-100' : 'border-[#e2e8f0]'} shadow-sm p-5 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-lg" style={{ backgroundColor: color }}>
          {provider[0]}
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-[#0f172a]">{provider}</h3>
          <p className={`text-[12px] ${connected ? 'text-green-600' : 'text-[#94a3b8]'}`}>
            {connected ? '● ' : '○ '}{status}
          </p>
        </div>
      </div>
      <button onClick={onAction} disabled={disabled}
        className={`w-full py-2 rounded text-[13px] font-medium transition-colors ${
          connected ? 'bg-green-50 text-green-700 border border-green-200' :
          disabled ? 'bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed' :
          'bg-[#0f172a] text-white hover:bg-[#1e293b]'}`}>
        {actionLabel}
      </button>
    </div>
  )
}

function FormState({ accessKey, setAccessKey, secretKey, setSecretKey, region, setRegion, showSecret, setShowSecret, showGuide, setShowGuide, error, onConnect, onCancel }) {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[#e2e8f0] bg-gradient-to-r from-[#fff7ed] to-white">
        <h2 className="text-[17px] font-bold text-[#0f172a] flex items-center gap-2">
          <span className="w-6 h-6 bg-[#ff9900] rounded text-white text-xs flex items-center justify-center font-bold">A</span>
          Connect Amazon Web Services
        </h2>
      </div>
      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700 flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Access Key ID</label>
          <input type="text" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="AKIAXXXXXXXXXXXXXXXX"
            className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-lg text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-[#ff9900]/30 focus:border-[#ff9900]" />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Secret Access Key</label>
          <div className="relative">
            <input type={showSecret ? 'text' : 'password'} value={secretKey} onChange={e => setSecretKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••••••••••"
              className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-lg text-[14px] font-mono pr-10 focus:outline-none focus:ring-2 focus:ring-[#ff9900]/30 focus:border-[#ff9900]" />
            <button onClick={() => setShowSecret(!showSecret)} type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]">
              {showSecret ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Region</label>
          <select value={region} onChange={e => setRegion(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#e2e8f0] rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#ff9900]/30 focus:border-[#ff9900] bg-white">
            {AWS_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.value})</option>)}
          </select>
        </div>

        {/* Guide toggle */}
        <button onClick={() => setShowGuide(!showGuide)} className="text-[13px] text-[#2563eb] hover:underline flex items-center gap-1">
          <span>{showGuide ? '▾' : '▸'}</span> How to get these keys?
        </button>

        {showGuide && <GuideSteps />}

        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-3 text-[12px] text-[#15803d] flex items-center gap-2">
          <span>🔒</span>
          <span>Keys are encrypted with AES-256 before storage. We never store plain text credentials.</span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-5 py-2.5 text-[13px] font-medium text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc]">
            Cancel
          </button>
          <button onClick={onConnect} className="px-5 py-2.5 text-[13px] font-medium text-white bg-[#ff9900] rounded-lg hover:bg-[#e68a00] shadow-sm flex items-center gap-2">
            Connect AWS →
          </button>
        </div>
      </div>
    </div>
  )
}

function GuideSteps() {
  const steps = [
    { n: 1, text: 'Go to aws.amazon.com → sign in → search "IAM" in the top search bar' },
    { n: 2, text: 'Click "Users" in the left menu → "Create user" button (top right)' },
    { n: 3, text: 'Username: "devops-copilot-monitor" → Next → Select "Attach policies directly" → Search "ReadOnlyAccess" → tick the checkbox → Next → Create user' },
    { n: 4, text: 'Click on the new user → "Security credentials" tab → "Create access key" → Select "Application running outside AWS" → Next → Create access key' },
    { n: 5, text: 'Copy both keys and paste them above. ⚠️ You can only see the Secret Key once — save it somewhere safe.' },
  ]
  return (
    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4 space-y-3">
      <p className="text-[13px] font-semibold text-[#334155]">How to create AWS access keys:</p>
      {steps.map(s => (
        <div key={s.n} className="flex gap-3 text-[13px] text-[#475569]">
          <span className="flex-shrink-0 w-6 h-6 bg-[#0f172a] text-white rounded-full flex items-center justify-center text-[11px] font-bold">{s.n}</span>
          <span>{s.text}</span>
        </div>
      ))}
    </div>
  )
}

function ConnectingState({ steps, currentStep }) {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm p-8">
      <h2 className="text-[17px] font-bold text-[#0f172a] mb-6">Connecting to AWS...</h2>
      <div className="space-y-4 max-w-md">
        {steps.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div key={step.key} className="flex items-center gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] ${
                done ? 'bg-green-500 text-white' : active ? 'bg-[#ff9900] text-white animate-pulse' : 'bg-[#f1f5f9] text-[#94a3b8]'}`}>
                {done ? '✓' : active ? '⟳' : '○'}
              </span>
              <span className={`text-[14px] ${done ? 'text-green-700 font-medium' : active ? 'text-[#0f172a] font-medium' : 'text-[#94a3b8]'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-[#94a3b8] mt-6">This usually takes 15-30 seconds</p>
    </div>
  )
}

function ConnectedState({ statusData, instances, onDisconnect, onViewDashboard, onRefresh }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-green-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white text-lg">✓</div>
            <div>
              <h2 className="text-[17px] font-bold text-[#0f172a]">AWS Connected</h2>
              <p className="text-[13px] text-[#64748b]">
                Account: {statusData?.account_id || 'N/A'} | Region: {statusData?.region || 'N/A'}
              </p>
            </div>
          </div>
          <span className="bg-green-100 text-green-700 text-[12px] font-bold px-3 py-1 rounded-full uppercase">Active</span>
        </div>

        {instances.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#334155]">EC2 Instances Found:</h3>
              <button onClick={onRefresh} className="text-[12px] text-[#2563eb] hover:underline">↻ Refresh</button>
            </div>
            {instances.map(inst => (
              <div key={inst.instance_id} className="border border-[#e2e8f0] rounded-lg p-4 bg-[#f8fafc]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-bold text-[#0f172a]">{inst.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#64748b]">{inst.type}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${inst.state === 'running' ? 'bg-green-100 text-green-700' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                      ● {inst.state}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-[13px] text-[#475569]">
                  <span>CPU: <b>{inst.cpu ?? 0}%</b></span>
                  <span>RAM: <b>{inst.ram ?? 0}%</b></span>
                  <span>Disk: <b>{inst.disk ?? 0}%</b></span>
                </div>
                <div className="mt-2 text-[12px]">
                  <span className={inst.cloudwatch_agent || inst.cloudwatch_agent_installed ? 'text-green-600' : 'text-amber-600'}>
                    CloudWatch Agent: {inst.cloudwatch_agent || inst.cloudwatch_agent_installed ? '✓ Active' : '⚠ Not installed'}
                  </span>
                </div>
                {inst.agent_note && <p className="text-[11px] text-amber-600 mt-1">{inst.agent_note}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#e2e8f0]">
          <p className="text-[12px] text-[#94a3b8]">Metrics updating every 60 seconds</p>
          <div className="flex gap-3">
            <button onClick={onViewDashboard} className="px-4 py-2 text-[13px] font-medium text-white bg-[#0f172a] rounded-lg hover:bg-[#1e293b]">
              View Dashboard →
            </button>
            <button onClick={onDisconnect} className="px-4 py-2 text-[13px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
