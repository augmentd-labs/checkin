import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import type { Tables } from '@/types/database'

type GuestRow = Pick<Tables<'guests'>, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'country_of_residence' | 'anonymized_at' | 'created_at'>

const ANON = '[ANONYMIZED]'

type SortField = 'last_name' | 'email' | 'created_at'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'anonymized'

function SortLink({
  field,
  label,
  current,
  dir,
  search,
  status,
}: {
  field: SortField
  label: string
  current: SortField
  dir: SortDir
  search: string
  status: StatusFilter
}) {
  const isActive = current === field
  const nextDir = isActive && dir === 'asc' ? 'desc' : 'asc'
  const arrow = isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <a
      href={`/admin/guests?q=${search}&sort=${field}&dir=${nextDir}&status=${status}`}
      className={`hover:text-gray-700 ${isActive ? 'text-gray-700' : 'text-gray-500'}`}
    >
      {label}{arrow}
    </a>
  )
}

export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; sort?: string; dir?: string; status?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/dashboard')

  const search = searchParams.q ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const sort: SortField =
    searchParams.sort === 'last_name' || searchParams.sort === 'email' || searchParams.sort === 'created_at'
      ? searchParams.sort
      : 'created_at'
  const dir: SortDir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const status: StatusFilter =
    searchParams.status === 'active' || searchParams.status === 'anonymized'
      ? searchParams.status
      : 'all'

  const pageSize = 25
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('guests')
    .select('id, first_name, last_name, email, phone, country_of_residence, anonymized_at, created_at', { count: 'exact' })
    .order(sort, { ascending: dir === 'asc' })
    .range(offset, offset + pageSize - 1)

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (status === 'active') query = query.is('anonymized_at', null)
  if (status === 'anonymized') query = query.not('anonymized_at', 'is', null)

  const { data: guests, count } = await query as unknown as { data: GuestRow[] | null; count: number | null }

  const guestIds = (guests ?? []).map((g) => g.id)
  const reservationCountMap: Record<string, number> = {}
  if (guestIds.length > 0) {
    const { data: counts } = await supabase
      .from('reservations')
      .select('guest_id')
      .in('guest_id', guestIds) as unknown as { data: { guest_id: string | null }[] | null }
    for (const row of counts ?? []) {
      if (row.guest_id) reservationCountMap[row.guest_id] = (reservationCountMap[row.guest_id] ?? 0) + 1
    }
  }

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const exportUrl = `/api/admin/guests/export?q=${encodeURIComponent(search)}&status=${status}`

  return (
    <div className="px-6 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Guests</h1>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <form method="get" className="flex gap-2 flex-1 min-w-0">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <input type="hidden" name="status" value={status} />
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Search by name or email…"
            className="flex-1 min-w-0 rounded-lg border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm border px-3 py-2"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
          >
            Search
          </button>
          {search && (
            <a
              href={`/admin/guests?sort=${sort}&dir=${dir}&status=${status}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear
            </a>
          )}
        </form>

        {/* Status tabs */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {(['all', 'active', 'anonymized'] as const).map((s) => (
            <a
              key={s}
              href={`/admin/guests?q=${search}&sort=${sort}&dir=${dir}&status=${s}`}
              className={`px-3 py-2 font-medium capitalize ${
                status === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </a>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        {count ?? 0} guest{(count ?? 0) !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
        {status !== 'all' && ` · ${status}`}
      </p>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <SortLink field="last_name" label="Name" current={sort} dir={dir} search={search} status={status} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <SortLink field="email" label="Email" current={sort} dir={dir} search={search} status={status} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stays</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <SortLink field="created_at" label="Registered" current={sort} dir={dir} search={search} status={status} />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(guests ?? []).map((guest) => {
              const isAnon = !!guest.anonymized_at
              return (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {isAnon ? ANON : `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || '—'}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{guest.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {isAnon ? ANON : guest.email ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {isAnon ? '—' : guest.country_of_residence ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {reservationCountMap[guest.id] ?? 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAnon ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Anonymized {format(new Date(guest.anonymized_at!), 'dd MMM yyyy')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(guest.created_at), 'dd MMM yyyy')}
                  </td>
                </tr>
              )
            })}
            {(guests ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  No guests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/admin/guests?q=${search}&sort=${sort}&dir=${dir}&status=${status}&page=${page - 1}`}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/admin/guests?q=${search}&sort=${sort}&dir=${dir}&status=${status}&page=${page + 1}`}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
