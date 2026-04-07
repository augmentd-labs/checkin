import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { sendCheckinConfirmedEmail } from '@/lib/resend/templates'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: reservation, error: fetchError } = await admin
    .from('reservations')
    .select(`
      id, check_in, check_out, status, guest_id, property_id,
      properties ( name, address, city, wifi_ssid, wifi_password, house_rules_url ),
      guests ( email, first_name, last_name )
    `)
    .eq('id', params.id)
    .single() as unknown as {
      data: {
        id: string
        check_in: string
        check_out: string
        status: string
        guest_id: string | null
        property_id: string | null
        properties: { name: string; address: string; city: string; wifi_ssid: string | null; wifi_password: string | null; house_rules_url: string | null } | null
        guests: { email: string | null; first_name: string | null; last_name: string | null } | null
      } | null
      error: { message: string } | null
    }

  if (fetchError || !reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (reservation.status !== 'checkin_submitted') {
    return NextResponse.json({ error: 'Reservation is not pending review' }, { status: 409 })
  }

  const { error: updateError } = await admin
    .from('reservations')
    .update({
      status: 'checked_in',
      checkin_accepted_at: new Date().toISOString(),
      checkin_accepted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  }

  await logAudit({
    actorId: user.id,
    action: 'approve_checkin',
    resourceType: 'reservation',
    resourceId: reservation.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  // Send confirmation email
  const guest = reservation.guests
  const property = reservation.properties
  if (guest?.email && property) {
    const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest'
    await sendCheckinConfirmedEmail({
      to: guest.email,
      guestName,
      propertyName: property.name,
      propertyAddress: `${property.address}, ${property.city}`,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      wifiSsid: property.wifi_ssid ?? undefined,
      wifiPassword: property.wifi_password ?? undefined,
      houseRulesUrl: property.house_rules_url ?? undefined,
    }).catch((err: unknown) => {
      console.error('Failed to send approval email:', err)
    })
  }

  return NextResponse.json({ success: true })
}
