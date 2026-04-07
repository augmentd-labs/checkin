import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'

  const admin = createAdminClient()
  let query = admin
    .from('guests')
    .select('id, first_name, last_name, email, phone, country_of_residence, anonymized_at, created_at')
    .order('last_name', { ascending: true })

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (status === 'active') query = query.is('anonymized_at', null)
  if (status === 'anonymized') query = query.not('anonymized_at', 'is', null)

  type GuestRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; country_of_residence: string | null; anonymized_at: string | null; created_at: string }
  const { data: guests, error } = await query as unknown as { data: GuestRow[] | null; error: { message: string } | null }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reservation counts
  const guestIds = (guests ?? []).map((g) => g.id)
  const reservationCountMap: Record<string, number> = {}
  if (guestIds.length > 0) {
    const { data: counts } = await admin.from('reservations').select('guest_id').in('guest_id', guestIds) as unknown as { data: { guest_id: string | null }[] | null }
    for (const row of counts ?? []) {
      if (row.guest_id) reservationCountMap[row.guest_id] = (reservationCountMap[row.guest_id] ?? 0) + 1
    }
  }

  await logAudit({
    actorId: user.id,
    action: 'export_guests_csv',
    resourceType: 'guests',
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  const ANON = '[ANONYMIZED]'
  const headers = ['ID', 'First name', 'Last name', 'Email', 'Phone', 'Country of residence', 'Stays', 'Status', 'Registered']

  const rows = (guests ?? []).map((g) => {
    const isAnon = !!g.anonymized_at
    return [
      g.id,
      isAnon ? ANON : g.first_name ?? '',
      isAnon ? ANON : g.last_name ?? '',
      isAnon ? ANON : g.email ?? '',
      isAnon ? ANON : g.phone ?? '',
      isAnon ? '—' : g.country_of_residence ?? '',
      reservationCountMap[g.id] ?? 0,
      isAnon ? `Anonymized ${g.anonymized_at!.slice(0, 10)}` : 'Active',
      g.created_at.slice(0, 10),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  })

  const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n')
  const filename = `guests-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
