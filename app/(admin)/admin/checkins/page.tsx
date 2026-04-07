import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import CheckinActions from './checkin-actions'

type PendingCheckin = {
  id: string
  check_in: string
  check_out: string
  checkin_submitted_at: string | null
  platform: string
  platform_reservation_id: string
  adults: number
  children: number
  properties: { name: string; city: string } | null
  guests: {
    first_name: string | null
    last_name: string | null
    email: string | null
    address_city: string | null
    address_country: string | null
    country_of_residence: string | null
    id_type: string | null
  } | null
}

export default async function AdminCheckinsPage({
  searchParams,
}: {
  searchParams: { property?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/dashboard')

  const propertyFilter = searchParams.property ?? ''

  let query = supabase
    .from('reservations')
    .select(`
      id,
      check_in,
      check_out,
      checkin_submitted_at,
      platform,
      platform_reservation_id,
      adults,
      children,
      properties ( name, city ),
      guests ( first_name, last_name, email, address_city, address_country, country_of_residence, id_type )
    `)
    .eq('status', 'checkin_submitted')
    .order('check_in', { ascending: true })

  if (propertyFilter) {
    query = query.eq('property_id', propertyFilter)
  }

  const { data: checkins } = await query as unknown as { data: PendingCheckin[] | null }

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, city')
    .order('name')

  return (
    <div className="px-6 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pending Check-ins</h1>
          <p className="text-sm text-slate-500 mt-1">
            {(checkins ?? []).length} awaiting review
          </p>
        </div>

        {/* Property filter */}
        <form method="get" className="flex items-center gap-2">
          <select
            name="property"
            defaultValue={propertyFilter}
            className="rounded-lg border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm border px-3 py-2"
          >
            <option value="">All properties</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.city})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
          >
            Filter
          </button>
        </form>
      </div>

      {(checkins ?? []).length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg font-medium">No pending check-ins</p>
          <p className="text-gray-400 text-sm mt-1">All check-ins are up to date.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Residence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(checkins ?? []).map((c) => {
                const guest = c.guests
                const guestName = guest
                  ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || '—'
                  : '—'
                const residence = guest
                  ? [guest.address_city, guest.address_country].filter(Boolean).join(', ') || '—'
                  : '—'

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{guestName}</div>
                      <div className="text-xs text-gray-400">{guest?.email ?? '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {c.properties?.name ?? '—'}
                      <div className="text-xs text-gray-400">{c.properties?.city}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(c.check_in), 'dd MMM yyyy')}
                      <div className="text-xs text-gray-400">
                        {c.adults}A {c.children > 0 ? `${c.children}C` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {residence}
                      {guest?.country_of_residence && guest.country_of_residence !== guest.address_country && (
                        <div className="text-xs text-gray-400">Resident: {guest.country_of_residence}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">
                      {guest?.id_type?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {c.checkin_submitted_at
                        ? format(new Date(c.checkin_submitted_at), 'dd MMM HH:mm')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <CheckinActions reservationId={c.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
