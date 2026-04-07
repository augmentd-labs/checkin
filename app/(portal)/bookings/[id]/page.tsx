import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format, differenceInDays } from 'date-fns'
import type { Tables } from '@/types/database'

type ReservationWithProperty = Tables<'reservations'> & {
  properties: Tables<'properties'> | null
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  modified: 'bg-yellow-100 text-yellow-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-gray-100 text-gray-800',
}

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, properties(*)')
    .eq('id', params.id)
    .eq('guest_id', user.id)
    .single() as { data: ReservationWithProperty | null }

  if (!reservation) {
    notFound()
  }

  const property = reservation.properties
  const now = new Date()
  const checkInDate = new Date(reservation.check_in)
  const daysUntilCheckIn = differenceInDays(checkInDate, now)

  const showLockCode =
    reservation.lock_access_code &&
    (reservation.status === 'checked_in' || daysUntilCheckIn <= 7)

  const colorClass = STATUS_COLORS[reservation.status] ?? 'bg-gray-100 text-gray-800'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              &larr; Dashboard
            </a>
            <h1 className="text-2xl font-bold text-gray-900">Booking Details</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Property & Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {property?.name ?? 'Unknown Property'}
              </h2>
              {property && (
                <p className="text-sm text-gray-500 mt-1">
                  {property.address}, {property.city}
                </p>
              )}
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
              {reservation.status.replace('_', ' ')}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Check-in</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {format(checkInDate, 'dd MMM yyyy')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">from 14:00</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Check-out</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {format(new Date(reservation.check_out), 'dd MMM yyyy')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">until 12:00</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Guests</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {reservation.adults} adult{reservation.adults !== 1 ? 's' : ''}
                {reservation.children > 0
                  ? `, ${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}`
                  : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Platform</p>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                {reservation.platform.replace('_', '.')}
              </p>
            </div>
          </div>

          {reservation.total_price != null && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                Total:{' '}
                <span className="font-medium text-gray-900">
                  {reservation.total_price.toFixed(2)} {reservation.currency}
                </span>
              </p>
              {reservation.city_tax_amount != null && (
                <p className="text-sm text-gray-500 mt-1">
                  City tax: {reservation.city_tax_amount.toFixed(2)} {reservation.currency}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Access Information */}
        {(showLockCode || reservation.parking_access_code) && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Access</h3>

            {showLockCode && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Door Lock PIN</p>
                <p className="text-3xl font-mono font-bold text-blue-800 mt-2 tracking-widest">
                  {reservation.lock_access_code}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Valid from 14:00 on check-in date until 12:00 on check-out date
                </p>
              </div>
            )}

            {!showLockCode && reservation.lock_access_code && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">
                  Door lock PIN will be shown 7 days before check-in.
                </p>
              </div>
            )}

            {reservation.parking_access_code && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-900">Parking Access Code</p>
                <p className="text-3xl font-mono font-bold text-green-800 mt-2 tracking-widest">
                  {reservation.parking_access_code}
                </p>
              </div>
            )}
          </div>
        )}

        {!showLockCode && !reservation.lock_access_code && reservation.status === 'confirmed' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access</h3>
            <p className="text-sm text-gray-500">
              Your door lock PIN will be sent by email and SMS 7 days before check-in. It will also
              appear here once available.
            </p>
          </div>
        )}

        {/* Invoice */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice</h3>
          {reservation.invoice_id ? (
            <div>
              <p className="text-sm text-gray-600">
                Invoice{' '}
                <span className="font-medium">{reservation.invoice_id}</span>
                {reservation.invoice_sent_at && (
                  <span className="text-gray-400 ml-2">
                    (sent {format(new Date(reservation.invoice_sent_at), 'dd MMM yyyy')})
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Your invoice was sent to your email address. Please check your inbox.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Invoice will be generated after check-out and sent to your email.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
