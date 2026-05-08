import { useState } from 'react'

const clouds = [
  { id: 'aws', name: 'Amazon Web Services', label: 'IAM Role ARN', placeholder: 'arn:aws:iam::123456789:role/CloudyBro' },
  { id: 'azure', name: 'Microsoft Azure', label: 'Service Principal ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  { id: 'gcp', name: 'Google Cloud Platform', label: 'Service Account JSON', placeholder: 'Paste service account JSON...' },
]

export default function Settings() {
  const [connected, setConnected] = useState({ aws: false, azure: false, gcp: false })
  const [creds, setCreds] = useState({ aws: '', azure: '', gcp: '' })
  const [thresholds, setThresholds] = useState({ cpu: 85, ram: 90, disk: 80, silent: 3 })
  const [saved, setSaved] = useState(false)

  const toggleConnect = (id) => {
    setConnected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSaveThresholds = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a] dark:text-gray-100 mb-6">Settings</h1>

      {/* Cloud connections */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-[#0f172a] dark:text-gray-100 mb-4">Cloud Connections</h2>
        <div className="grid grid-cols-3 gap-4">
          {clouds.map((cloud) => (
            <div key={cloud.id} className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-5 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm text-[#0f172a] dark:text-gray-100">{cloud.name}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2 h-2 rounded-full ${connected[cloud.id] ? 'bg-[#16a34a]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className={connected[cloud.id] ? 'text-[#16a34a]' : 'text-[#64748b] dark:text-gray-400'}>
                    {connected[cloud.id] ? 'Connected' : 'Not Connected'}
                  </span>
                </span>
              </div>

              <label className="block text-xs text-[#64748b] dark:text-gray-400 font-medium mb-1.5">{cloud.label}</label>
              {cloud.id === 'gcp' ? (
                <textarea
                  value={creds[cloud.id]}
                  onChange={(e) => setCreds((p) => ({ ...p, [cloud.id]: e.target.value }))}
                  placeholder={cloud.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-xs text-[#0f172a] dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent resize-none mb-3"
                />
              ) : (
                <input
                  type="password"
                  value={creds[cloud.id]}
                  onChange={(e) => setCreds((p) => ({ ...p, [cloud.id]: e.target.value }))}
                  placeholder={cloud.placeholder}
                  className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-xs text-[#0f172a] dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent mb-3"
                />
              )}

              <button
                onClick={() => toggleConnect(cloud.id)}
                className={`w-full py-2 text-xs font-semibold rounded-lg transition-colors ${
                  connected[cloud.id]
                    ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40'
                    : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                }`}
              >
                {connected[cloud.id] ? 'Disconnect' : 'Connect'}
              </button>

              <p className="text-[10px] text-[#94a3b8] mt-2 text-center">
                Credentials are encrypted with AES-256 before storage
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert thresholds */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-5 transition-colors">
        <h2 className="text-sm font-bold text-[#0f172a] dark:text-gray-100 mb-4">Alert Rules</h2>

        <div className="space-y-5">
          <SliderField
            label="CPU Spike Threshold"
            value={thresholds.cpu}
            onChange={(v) => setThresholds((p) => ({ ...p, cpu: v }))}
            min={50} max={100} unit="%"
          />
          <SliderField
            label="RAM Critical Threshold"
            value={thresholds.ram}
            onChange={(v) => setThresholds((p) => ({ ...p, ram: v }))}
            min={50} max={100} unit="%"
          />
          <SliderField
            label="Disk Warning Threshold"
            value={thresholds.disk}
            onChange={(v) => setThresholds((p) => ({ ...p, disk: v }))}
            min={50} max={100} unit="%"
          />
          <SliderField
            label="Silent Service Timeout"
            value={thresholds.silent}
            onChange={(v) => setThresholds((p) => ({ ...p, silent: v }))}
            min={1} max={10} unit=" min"
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSaveThresholds}
            className="px-6 py-2.5 bg-[#2563eb] text-white text-sm font-semibold rounded-lg hover:bg-[#1d4ed8] transition-colors"
          >
            Save Thresholds
          </button>
          {saved && (
            <span className="text-[#16a34a] text-sm font-semibold">✓ Saved successfully</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SliderField({ label, value, onChange, min, max, unit }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-[#64748b] dark:text-gray-400">{label}</span>
        <span className="font-semibold text-[#0f172a] dark:text-gray-100">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[#e2e8f0] dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#2563eb]"
      />
    </div>
  )
}
