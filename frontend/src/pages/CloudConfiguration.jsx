import { useState, useEffect } from 'react'
import { connectCloud, getCloudStatus, disconnectCloud, getCloudInstances, getTrustPolicy } from '../api/metrics'
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
  { key: 'validate_arn', label: 'Validating IAM Role ARN' },
  { key: 'assume_role', label: 'Assuming Role via STS' },
  { key: 'check_permissions', label: 'Verifying permissions' },
  { key: 'discover_instances', label: 'Discovering EC2 instances' },
  { key: 'setup_agent', label: 'Installing CloudWatch Agent' },
  { key: 'start_monitoring', label: 'Starting metrics collection' },
]

export default function CloudConfiguration() {
  const navigate = useNavigate()
  const [wizardState, setWizardState] = useState('loading')
  // Step 1 state
  const [trustPolicy, setTrustPolicy] = useState(null)
  const [externalId, setExternalId] = useState('')
  const [permissions, setPermissions] = useState([])
  const [selectedPerms, setSelectedPerms] = useState([])
  const [copiedPolicy, setCopiedPolicy] = useState(false)
  const [copiedExternalId, setCopiedExternalId] = useState(false)
  // Step 2 state
  const [roleArn, setRoleArn] = useState('')
  const [region, setRegion] = useState('us-east-1')
  // General state
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [instances, setInstances] = useState([])
  const [statusData, setStatusData] = useState(null)
  const [wizardStep, setWizardStep] = useState(1) // 1=create role, 2=connect, 3=connected

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    try {
      const res = await getCloudStatus()
      const aws = res.data?.aws
      if (aws?.connected) {
        setStatusData(aws)
        setWizardState('connected')
        setWizardStep(3)
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

  const loadTrustPolicy = async () => {
    try {
      const res = await getTrustPolicy()
      const data = res.data
      setTrustPolicy(data.trust_policy)
      setExternalId(data.external_id)
      setPermissions(data.required_permissions || [])
      // Pre-select required permissions
      const preSelected = (data.required_permissions || [])
        .filter(p => p.required)
        .map(p => p.policy_name)
      setSelectedPerms(preSelected)
    } catch {
      setError('Failed to load Trust Policy. Please refresh the page.')
    }
  }

  const handleStartWizard = async () => {
    setWizardState('wizard')
    setWizardStep(1)
    setError('')
    await loadTrustPolicy()
  }

  const togglePermission = (name, required) => {
    if (required) return
    setSelectedPerms(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    )
  }

  const handleConnect = async () => {
    setError('')
    if (!roleArn.trim()) {
      setError('Please enter your IAM Role ARN.')
      return
    }
    if (!/^arn:aws:iam::\d{12}:role\/.+$/.test(roleArn.trim())) {
      setError('Invalid Role ARN format. Example: arn:aws:iam::123456789012:role/DevOpsCopilotRole')
      return
    }
    setWizardState('connecting')
    setCurrentStep(0)

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
        role_arn: roleArn.trim(),
        region,
        selected_permissions: selectedPerms,
      })
      clearInterval(stepInterval)
      setCurrentStep(CONNECT_STEPS.length)
      setStatusData({
        connected: true,
        account_id: res.data.account_id,
        region: res.data.region,
        role_arn: res.data.role_arn,
        instances: res.data.instances_discovered?.length || 0,
      })
      setInstances(res.data.instances_discovered || [])
      setTimeout(() => {
        setWizardState('connected')
        setWizardStep(3)
      }, 1200)
    } catch (err) {
      clearInterval(stepInterval)
      const detail = err?.response?.data?.detail || 'Connection failed. Please verify your IAM Role configuration.'
      setError(detail)
      setWizardState('wizard')
      setWizardStep(2)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your AWS account?')) return
    try {
      await disconnectCloud({ provider: 'aws' })
      setWizardState('disconnected')
      setWizardStep(1)
      setStatusData(null)
      setInstances([])
      setRoleArn('')
    } catch {
      setError('Failed to disconnect. Please try again.')
    }
  }

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text)
    if (type === 'policy') {
      setCopiedPolicy(true)
      setTimeout(() => setCopiedPolicy(false), 2000)
    } else {
      setCopiedExternalId(true)
      setTimeout(() => setCopiedExternalId(false), 2000)
    }
  }

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-white">Cloud Configuration</h1>
        <p className="text-[13px] text-[#64748b] dark:text-gray-400 mt-1">
          Connect your cloud provider using IAM Role-based access — no permanent credentials stored.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ProviderCard provider="AWS" color="#ff9900" connected={wizardState === 'connected'}
          onAction={() => wizardState === 'connected' ? null : handleStartWizard()}
          actionLabel={wizardState === 'connected' ? '✓ Connected' : 'Connect'}
          status={wizardState === 'connected' ? 'Connected' : 'Not connected'} />
        <ProviderCard provider="Azure" color="#0078d4" connected={false} actionLabel="Coming Soon" disabled status="Not connected" />
        <ProviderCard provider="GCP" color="#ea4335" connected={false} actionLabel="Coming Soon" disabled status="Not connected" />
      </div>

      {/* WIZARD — Step 1: Create IAM Role */}
      {wizardState === 'wizard' && wizardStep === 1 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-lg border border-[#e2e8f0] dark:border-[#334155] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#e2e8f0] dark:border-[#334155] bg-gradient-to-r from-[#fff7ed] to-white dark:from-[#1e293b] dark:to-[#1e293b]">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 bg-[#ff9900] rounded text-white text-xs flex items-center justify-center font-bold">1</span>
                Create IAM Role in Your AWS Account
              </h2>
              <span className="text-[12px] text-[#94a3b8]">Step 1 of 2</span>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-[13px] text-red-700 dark:text-red-400 flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{error}</span>
              </div>
            )}

            {/* Setup Guide */}
            <div className="bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 space-y-3">
              <p className="text-[13px] font-semibold text-[#334155] dark:text-gray-300">Follow these steps in your AWS Console:</p>
              {[
                'Go to AWS Console → IAM → Roles → Create Role',
                'Select "Custom trust policy" as the trusted entity type',
                'Paste the Trust Policy JSON below → Next',
                'Attach the permissions listed below → Next → Name your role → Create Role',
                'Copy the Role ARN from the role summary page',
              ].map((text, i) => (
                <div key={i} className="flex gap-3 text-[13px] text-[#475569] dark:text-gray-400">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#0f172a] dark:bg-[#2563eb] text-white rounded-full flex items-center justify-center text-[11px] font-bold">{i + 1}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Trust Policy JSON */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-semibold text-[#334155] dark:text-gray-300">Trust Policy JSON</label>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(trustPolicy, null, 2), 'policy')}
                  className="text-[12px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] flex items-center gap-1"
                >
                  {copiedPolicy ? 'Copied!' : 'Copy to clipboard'}
                </button>
              </div>
              <pre className="bg-[#0f172a] text-[#e2e8f0] p-4 rounded-lg text-[12px] font-mono overflow-x-auto leading-relaxed border border-[#334155]">
                {trustPolicy ? JSON.stringify(trustPolicy, null, 2) : 'Loading...'}
              </pre>
            </div>

            {/* ExternalId */}
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-1.5">Your Unique External ID</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#fef3c7] dark:bg-amber-900/30 border border-[#fbbf24] dark:border-amber-700 rounded-lg px-4 py-2.5 text-[14px] font-mono font-bold text-[#92400e] dark:text-amber-300">
                  {externalId || 'Loading...'}
                </div>
                <button
                  onClick={() => copyToClipboard(externalId, 'externalId')}
                  className="px-4 py-2.5 text-[12px] font-bold text-[#2563eb] border border-[#e2e8f0] dark:border-[#334155] rounded-lg hover:bg-[#f8fafc] dark:hover:bg-[#334155] transition-colors"
                >
                  {copiedExternalId ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-1">This is already embedded in the Trust Policy above. It prevents unauthorized access (confused deputy protection).</p>
            </div>

            {/* Permissions Checklist */}
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-2">Attach these AWS Managed Policies to your Role:</label>
              <div className="space-y-2">
                {permissions.map(perm => (
                  <label key={perm.policy_name}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      selectedPerms.includes(perm.policy_name)
                        ? 'border-[#2563eb]/30 bg-[#eff6ff] dark:border-[#2563eb]/40 dark:bg-[#1e293b]'
                        : 'border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a]'
                    } ${perm.required ? 'cursor-default' : 'cursor-pointer hover:border-[#2563eb]/50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm.policy_name)}
                      onChange={() => togglePermission(perm.policy_name, perm.required)}
                      disabled={perm.required}
                      className="mt-0.5 w-4 h-4 accent-[#2563eb]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#0f172a] dark:text-white">{perm.policy_name}</span>
                        {perm.required && (
                          <span className="text-[10px] font-bold text-[#2563eb] bg-[#dbeafe] dark:bg-[#1e3a5f] px-1.5 py-0.5 rounded">REQUIRED</span>
                        )}
                        {!perm.required && (
                          <span className="text-[10px] font-bold text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#334155] px-1.5 py-0.5 rounded">OPTIONAL</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#64748b] dark:text-gray-400 mt-0.5">{perm.description}</p>
                      <p className="text-[11px] text-[#94a3b8] font-mono mt-0.5">{perm.arn}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Security note */}
            <div className="bg-[#f0fdf4] dark:bg-green-900/20 border border-[#bbf7d0] dark:border-green-800 rounded-lg p-3 text-[12px] text-[#15803d] dark:text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              <span>No permanent credentials are stored. We use STS AssumeRole to get temporary credentials that expire in 1 hour and auto-refresh.</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setWizardState('disconnected'); setError('') }}
                className="px-5 py-2.5 text-[13px] font-medium text-[#64748b] dark:text-gray-400 border border-[#e2e8f0] dark:border-[#334155] rounded-lg hover:bg-[#f8fafc] dark:hover:bg-[#334155]">
                Cancel
              </button>
              <button onClick={() => { setWizardStep(2); setError('') }}
                className="px-5 py-2.5 text-[13px] font-medium text-white bg-[#ff9900] rounded-lg hover:bg-[#e68a00] shadow-sm flex items-center gap-2">
                I've created the role →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIZARD — Step 2: Connect Role */}
      {wizardState === 'wizard' && wizardStep === 2 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-lg border border-[#e2e8f0] dark:border-[#334155] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#e2e8f0] dark:border-[#334155] bg-gradient-to-r from-[#fff7ed] to-white dark:from-[#1e293b] dark:to-[#1e293b]">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 bg-[#ff9900] rounded text-white text-xs flex items-center justify-center font-bold">2</span>
                Connect Your IAM Role
              </h2>
              <span className="text-[12px] text-[#94a3b8]">Step 2 of 2</span>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-[13px] text-red-700 dark:text-red-400 flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-1.5">IAM Role ARN</label>
              <input type="text" value={roleArn} onChange={e => setRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/DevOpsCopilotRole"
                className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-[#334155] rounded-lg text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-[#ff9900]/30 focus:border-[#ff9900] bg-white dark:bg-[#0f172a] dark:text-white" />
              <p className="text-[11px] text-[#94a3b8] mt-1">Find this on the role summary page in AWS IAM Console</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-1.5">Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-[#334155] rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#ff9900]/30 focus:border-[#ff9900] bg-white dark:bg-[#0f172a] dark:text-white">
                {AWS_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.value})</option>)}
              </select>
            </div>

            <div className="bg-[#f0fdf4] dark:bg-green-900/20 border border-[#bbf7d0] dark:border-green-800 rounded-lg p-3 text-[12px] text-[#15803d] dark:text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              <span>Only the Role ARN is stored — no access keys, no secrets. Temporary credentials auto-refresh every 55 minutes.</span>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => { setWizardStep(1); setError('') }}
                className="px-5 py-2.5 text-[13px] font-medium text-[#64748b] dark:text-gray-400 border border-[#e2e8f0] dark:border-[#334155] rounded-lg hover:bg-[#f8fafc] dark:hover:bg-[#334155]">
                ← Back
              </button>
              <button onClick={handleConnect}
                className="px-5 py-2.5 text-[13px] font-medium text-white bg-[#ff9900] rounded-lg hover:bg-[#e68a00] shadow-sm flex items-center gap-2">
                Connect AWS →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connecting animation */}
      {wizardState === 'connecting' && (
        <ConnectingState steps={CONNECT_STEPS} currentStep={currentStep} />
      )}

      {/* Connected state */}
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
    <div className={`bg-white dark:bg-[#1e293b] rounded-lg border ${connected ? 'border-green-300 dark:border-green-700 ring-1 ring-green-100 dark:ring-green-900' : 'border-[#e2e8f0] dark:border-[#334155]'} shadow-sm p-5 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-lg" style={{ backgroundColor: color }}>
          {provider[0]}
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-[#0f172a] dark:text-white">{provider}</h3>
          <p className={`text-[12px] ${connected ? 'text-green-600 dark:text-green-400' : 'text-[#94a3b8]'}`}>
            {connected ? '● ' : '○ '}{status}
          </p>
        </div>
      </div>
      <button onClick={onAction} disabled={disabled}
        className={`w-full py-2 rounded text-[13px] font-medium transition-colors ${
          connected ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' :
          disabled ? 'bg-[#f1f5f9] dark:bg-[#334155] text-[#94a3b8] cursor-not-allowed' :
          'bg-[#0f172a] text-white hover:bg-[#1e293b]'}`}>
        {actionLabel}
      </button>
    </div>
  )
}

function ConnectingState({ steps, currentStep }) {
  return (
    <div className="bg-white dark:bg-[#1e293b] rounded-lg border border-[#e2e8f0] dark:border-[#334155] shadow-sm p-8">
      <h2 className="text-[17px] font-bold text-[#0f172a] dark:text-white mb-6">Connecting to AWS...</h2>
      <div className="space-y-4 max-w-md">
        {steps.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div key={step.key} className="flex items-center gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                done ? 'bg-green-500 text-white' : active ? 'bg-[#ff9900] text-white' : 'bg-[#f1f5f9] dark:bg-[#334155] text-[#94a3b8]'}`}>
                {done ? (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ) : active ? (
                  <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                )}
              </span>
              <span className={`text-[14px] ${done ? 'text-green-700 dark:text-green-400 font-medium' : active ? 'text-[#0f172a] dark:text-white font-medium' : 'text-[#94a3b8]'}`}>
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
      <div className="bg-white dark:bg-[#1e293b] rounded-lg border border-green-200 dark:border-green-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#0f172a] dark:text-white">AWS Connected</h2>
              <p className="text-[13px] text-[#64748b] dark:text-gray-400">
                Account: {statusData?.account_id || 'N/A'} | Region: {statusData?.region || 'N/A'}
              </p>
            </div>
          </div>
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[12px] font-bold px-3 py-1 rounded-full uppercase">Active</span>
        </div>

        {statusData?.role_arn && (
          <div className="mb-4 p-3 bg-[#f8fafc] dark:bg-[#0f172a] rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
            <p className="text-[11px] text-[#94a3b8] mb-1">IAM Role ARN</p>
            <p className="text-[12px] font-mono text-[#475569] dark:text-gray-300 break-all">{statusData.role_arn}</p>
          </div>
        )}

        {instances.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#334155] dark:text-gray-300">EC2 Instances Found:</h3>
              <button onClick={onRefresh} className="text-[12px] text-[#2563eb] hover:underline">↻ Refresh</button>
            </div>
            {instances.map(inst => (
              <div key={inst.instance_id} className="border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 bg-[#f8fafc] dark:bg-[#0f172a]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-bold text-[#0f172a] dark:text-white">{inst.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#64748b] dark:text-gray-400">{inst.type}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${inst.state === 'running' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-[#f1f5f9] dark:bg-[#334155] text-[#64748b]'}`}>
                      ● {inst.state}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-[13px] text-[#475569] dark:text-gray-400">
                  <span>CPU: <b className="dark:text-white">{inst.cpu ?? 0}%</b></span>
                  <span>RAM: <b className="dark:text-white">{inst.ram ?? 0}%</b></span>
                  <span>Disk: <b className="dark:text-white">{inst.disk ?? 0}%</b></span>
                </div>
                <div className="mt-2 text-[12px]">
                  <span className={inst.cloudwatch_agent || inst.cloudwatch_agent_installed ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                    CloudWatch Agent: {inst.cloudwatch_agent || inst.cloudwatch_agent_installed ? 'Active' : 'Not installed'}
                  </span>
                </div>
                {inst.agent_note && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{inst.agent_note}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#e2e8f0] dark:border-[#334155]">
          <p className="text-[12px] text-[#94a3b8]">Metrics updating every 60 seconds • Credentials auto-refresh every 55 min</p>
          <div className="flex gap-3">
            <button onClick={onViewDashboard} className="px-4 py-2 text-[13px] font-medium text-white bg-[#0f172a] rounded-lg hover:bg-[#1e293b]">
              View Dashboard →
            </button>
            <button onClick={onDisconnect} className="px-4 py-2 text-[13px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
