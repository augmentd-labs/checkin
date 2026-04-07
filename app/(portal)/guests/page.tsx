'use client'

import { useState, useEffect, useCallback } from 'react'

interface HouseholdMember {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  id_type: 'passport' | 'national_id' | null
  country_of_residence: string | null
}

const emptyForm = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  id_type: '' as 'passport' | 'national_id' | '',
  id_number: '',
  country_of_residence: '',
}

export default function GuestsPage() {
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    const res = await fetch('/api/guest-profiles')
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function openEdit(m: HouseholdMember) {
    setEditingId(m.id)
    setForm({
      first_name: m.first_name,
      last_name: m.last_name,
      date_of_birth: m.date_of_birth ?? '',
      id_type: m.id_type ?? '',
      id_number: '',
      country_of_residence: m.country_of_residence ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      date_of_birth: form.date_of_birth || null,
      id_type: form.id_type || null,
      id_number: form.id_number || undefined,
      country_of_residence: form.country_of_residence || null,
    }

    const url = editingId ? `/api/guest-profiles/${editingId}` : '/api/guest-profiles'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
      setSaving(false)
      return
    }

    setShowForm(false)
    await loadMembers()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this guest from your account?')) return
    await fetch(`/api/guest-profiles/${id}`, { method: 'DELETE' })
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="px-6 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guests</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add family members or travel companions to link them to reservations.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add guest
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {editingId ? 'Edit guest' : 'New guest'}
          </h2>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
              <input
                type="text" required
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
              <input
                type="text" required
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country of residence</label>
              <input
                type="text"
                value={form.country_of_residence}
                onChange={(e) => setForm((p) => ({ ...p, country_of_residence: e.target.value }))}
                placeholder="e.g. SK"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID type</label>
              <select
                value={form.id_type}
                onChange={(e) => setForm((p) => ({ ...p, id_type: e.target.value as typeof form.id_type }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              >
                <option value="">— select —</option>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID number {editingId && <span className="text-gray-400 font-normal">(leave blank to keep existing)</span>}
              </label>
              <input
                type="text"
                value={form.id_number}
                onChange={(e) => setForm((p) => ({ ...p, id_number: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add guest'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Guest list */}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : members.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="mt-3 text-slate-500 text-sm">No guests added yet.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of birth</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {m.first_name} {m.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.date_of_birth ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.country_of_residence ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.id_type ? m.id_type.replace('_', ' ') : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-sky-600 hover:text-sky-500 font-medium mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-red-500 hover:text-red-400 font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
