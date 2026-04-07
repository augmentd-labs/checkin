import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import Papa from 'papaparse'

const ExportSchema = z.object({
  exportType: z.enum(['city_tax', 'police', 'custom']),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  propertyIds: z.array(z.string().uuid()).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ExportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { exportType, dateFrom, dateTo, propertyIds } = parsed.data

  const adminSupabase = createAdminClient()

  let query = adminSupabase
    .from('reservations')
    .select(
      `
      id,
      platform,
      platform_reservation_id,
      check_in,
      check_out,
      status,
      adults,
      children,
      total_price,
      currency,
      city_tax_amount,
      property_id,
      guest_id,
      properties(name, address, city),
      guests(first_name, last_name, email, address_country, country_of_residence, id_type)
      `
    )
    .gte('check_in', dateFrom)
    .lte('check_in', dateTo)
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true })

  if (propertyIds && propertyIds.length > 0) {
    query = query.in('property_id', propertyIds)
  }

  type ReservationRow = {
    id: string; platform: string; platform_reservation_id: string
    check_in: string; check_out: string; status: string
    adults: number; children: number; total_price: number | null
    currency: string; city_tax_amount: number | null
    property_id: string | null; guest_id: string | null
    properties: { name: string; address: string; city: string } | null
    guests: { first_name: string | null; last_name: string | null; email: string | null; address_country: string | null; country_of_residence: string | null; id_type: string | null } | null
  }
  const { data: reservations, error: fetchError } = await query as unknown as { data: ReservationRow[] | null; error: { message: string } | null }

  if (fetchError) {
    console.error('Export fetch error:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }

  const rows = (reservations ?? []).map((r) => {
    const guest = r.guests as { first_name: string | null; last_name: string | null; email: string | null; address_country: string | null; country_of_residence: string | null; id_type: string | null } | null
    const property = r.properties as { name: string; address: string; city: string } | null

    if (exportType === 'city_tax') {
      return {
        reservation_id: r.id,
        platform: r.platform,
        platform_ref: r.platform_reservation_id,
        property: property?.name ?? '',
        city: property?.city ?? '',
        check_in: r.check_in,
        check_out: r.check_out,
        adults: r.adults,
        children: r.children,
        total_price: r.total_price,
        currency: r.currency,
        city_tax_amount: r.city_tax_amount,
      }
    }

    if (exportType === 'police') {
      return {
        reservation_id: r.id,
        platform: r.platform,
        platform_ref: r.platform_reservation_id,
        property: property?.name ?? '',
        address: property?.address ?? '',
        city: property?.city ?? '',
        check_in: r.check_in,
        check_out: r.check_out,
        adults: r.adults,
        children: r.children,
        guest_last_name: guest?.last_name ?? '',
        guest_first_name: guest?.first_name ?? '',
        guest_country: guest?.address_country ?? guest?.country_of_residence ?? '',
        id_type: guest?.id_type ?? '',
      }
    }

    // custom — all fields
    return {
      reservation_id: r.id,
      platform: r.platform,
      platform_ref: r.platform_reservation_id,
      status: r.status,
      property: property?.name ?? '',
      address: property?.address ?? '',
      city: property?.city ?? '',
      check_in: r.check_in,
      check_out: r.check_out,
      adults: r.adults,
      children: r.children,
      total_price: r.total_price,
      currency: r.currency,
      city_tax_amount: r.city_tax_amount,
      guest_last_name: guest?.last_name ?? '',
      guest_first_name: guest?.first_name ?? '',
      guest_email: guest?.email ?? '',
      guest_country: guest?.address_country ?? guest?.country_of_residence ?? '',
      id_type: guest?.id_type ?? '',
    }
  })

  const csv = Papa.unparse(rows)
  const filename = `export-${exportType}-${dateFrom}-to-${dateTo}.csv`

  // Log to compliance_exports table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase.from('compliance_exports') as any).insert({
    exported_by: user.id,
    export_type: exportType,
    date_from: dateFrom,
    date_to: dateTo,
    property_ids: propertyIds ?? null,
    row_count: rows.length,
    file_path: filename,
  })

  await logAudit({
    actorId: user.id,
    action: 'compliance_export',
    resourceType: 'compliance_exports',
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// Also expose a simple GET for listing properties (used by exports page)
export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json([])
}
