'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Platform = 'booking_com' | 'airbnb'

export default function ClaimPage() {
  const router = useRouter()
  const [platform, setPlatform] = useState<Platform>('booking_com')
  const [reservationId, setReservationId] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, reservationId, lastName }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Could not find reservation. Please check your details.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="px-6 py-8 max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Claim a booking</h1>
      <p className="text-sm text-slate-500 mb-8">
        Link an existing reservation to your account using your booking reference and last name.
      </p>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1">
              Booking platform
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
            >
              <option value="booking_com">Booking.com</option>
              <option value="airbnb">Airbnb</option>
            </select>
          </div>

          <div>
            <label htmlFor="reservationId" className="block text-sm font-medium text-gray-700 mb-1">
              Reservation / Confirmation number
            </label>
            <input
              type="text"
              id="reservationId"
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              required
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              placeholder="e.g. 1234567890"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last name (as on the booking)
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
              placeholder="Your last name"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Claim booking'}
          </button>
        </form>
      </div>
    </div>
  )
}
