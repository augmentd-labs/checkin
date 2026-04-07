import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import type { Tables } from '@/types/database'

type ReservationWithProperty = Tables<'reservations'> & {
  properties: Pick<Tables<'properties'>, 'name' | 'address' | 'city'> | null
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  modified: 'bg-yellow-100 text-yellow-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-gray-100 text-gray-800',
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function ReservationCard({ reservation }: { reservation: ReservationWithProperty }) {
  const property = reservation.properties
  return (
    <div className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {property?.name ?? 'Unknown Property'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {property ? `${property.address}, ${property.city}` : ''}
          </p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Check-in</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {format(new Date(reservation.check_in), 'dd MMM yyyy')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Check-out</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {format(new Date(reservation.check_out), 'dd MMM yyyy')}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <p className="text-xs text-gray-500">
          {reservation.adults} adult{reservation.adults !== 1 ? 's' : ''}
          {reservation.children > 0 ? `, ${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}` : ''}
        </p>
        <a
          href={`/bookings/${reservation.id}`}
          className="text-sm font-medium text-sky-600 hover:text-sky-500"
        >
          View details &rarr;
        </a>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: upcomingReservations } = await supabase
    .from('reservations')
    .select('*, properties(name, address, city)')
    .eq('guest_id', user.id)
    .gte('check_in', today)
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true })
    .limit(10) as { data: ReservationWithProperty[] | null }

  const { data: pastReservations } = await supabase
    .from('reservations')
    .select('*, properties(name, address, city)')
    .eq('guest_id', user.id)
    .lt('check_in', today)
    .order('check_in', { ascending: false })
    .limit(10) as { data: ReservationWithProperty[] | null }

  const upcoming = upcomingReservations ?? []
  const past = pastReservations ?? []

  return (
    <div className="px-6 py-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">My Reservations</h1>
      <div>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upcoming Stays</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-500">No upcoming reservations.</p>
              <p className="text-sm text-gray-400 mt-2">
                Have a booking reference?{' '}
                <a href="/claim" className="text-sky-600 hover:text-sky-500">
                  Claim it here
                </a>
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((r) => (
                <ReservationCard key={r.id} reservation={r} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Past Stays</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((r) => (
                <ReservationCard key={r.id} reservation={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
