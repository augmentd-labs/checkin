'use client'

import { useState, useEffect } from 'react'

type ExportType = 'city_tax' | 'police' | 'custom'

interface Property {
  id: string
  name: string
  city: string
}

export default function AdminExportsPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])
  const [exportType, setExportType] = useState<ExportType>('city_tax')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProperties() {
      const res = await fetch('/api/admin/properties')
      if (res.ok) setProperties(await res.json())
    }
    loadProperties()
  }, [])

  function toggleProperty(id: string) {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleExport() {
    setError(null)
    if (!dateFrom || !dateTo) { setError('Please select a date range.'); return }
    if (new Date(dateFrom) > new Date(dateTo)) { setError('Start date must be before end date.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportType,
          dateFrom,
          dateTo,
          propertyIds: selectedPropertyIds.length > 0 ? selectedPropertyIds : null,
        }),
      })
      if (!res.ok) { setError((await res.json()).error ?? 'Export failed.'); return }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('content-disposition')
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `export-${exportType}-${dateFrom}.csv`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Compliance Exports</h1>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Export Type */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Export type</h2>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'city_tax', label: 'City Tax', desc: 'Local tax reporting' },
              { value: 'police', label: 'Police Registration', desc: 'Foreign guest registration' },
              { value: 'custom', label: 'Custom', desc: 'All reservation data' },
            ] as { value: ExportType; label: string; desc: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExportType(opt.value)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  exportType === opt.value ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Date range</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" id="dateFrom" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" id="dateTo" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>
        </div>

        {/* Property Filter */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Properties</h2>
          <p className="text-sm text-gray-500 mb-4">Leave all unchecked to include all properties.</p>
          {properties.length === 0 ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <div className="space-y-2">
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={selectedPropertyIds.includes(p.id)} onChange={() => toggleProperty(p.id)}
                    className="h-4 w-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500" />
                  <span className="text-sm text-gray-900">{p.name} <span className="text-gray-400">{p.city}</span></span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={handleExport} disabled={loading}
            className="inline-flex justify-center py-2.5 px-6 text-sm font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Generating…' : 'Download export'}
          </button>
        </div>
      </div>
    </div>
  )
}
