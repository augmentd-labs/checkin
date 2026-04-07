'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckinActions({ reservationId }: { reservationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setLoading('approve')
    setError(null)
    const res = await fetch(`/api/admin/checkins/${reservationId}/approve`, { method: 'POST' })
    setLoading(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? 'Failed to approve')
      return
    }
    router.refresh()
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectReason.trim()) return
    setLoading('reject')
    setError(null)
    const res = await fetch(`/api/admin/checkins/${reservationId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    })
    setLoading(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? 'Failed to reject')
      return
    }
    setShowRejectForm(false)
    router.refresh()
  }

  if (showRejectForm) {
    return (
      <form onSubmit={handleReject} className="flex flex-col items-end gap-2 min-w-[220px]">
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection (sent to guest)"
          rows={2}
          className="w-full text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
          required
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowRejectForm(false)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading === 'reject'}
            className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
          >
            {loading === 'reject' ? 'Rejecting…' : 'Send rejection'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <p className="text-xs text-red-600 mr-1">{error}</p>}
      <button
        onClick={() => setShowRejectForm(true)}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
      <button
        onClick={handleApprove}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
      >
        {loading === 'approve' ? 'Approving…' : 'Approve'}
      </button>
    </div>
  )
}
