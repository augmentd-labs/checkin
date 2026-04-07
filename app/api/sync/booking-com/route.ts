import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchReservations, parseReservationsXML } from '@/lib/booking-com/client'
import { addDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import { sendCheckinEmail } from '@/lib/resend/templates'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header automatically)
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const hotelIds = (process.env.BOOKING_COM_HOTEL_IDS ?? '').split(',').filter(Boolean)

  if (hotelIds.length === 0) {
    return NextResponse.json({ error: 'No hotel IDs configured' }, { status: 500 })
  }

  let totalUpserted = 0
  let totalErrors = 0

  for (const hotelId of hotelIds) {
    try {
      const xml = await fetchReservations(hotelId.trim())
      const reservations = parseReservationsXML(xml)

      for (const res of reservations) {
        const { error } = await supabase
          .from('reservations')
          .upsert(
            {
              platform: 'booking_com',
              platform_reservation_id: res.platformReservationId,
              platform_pin: res.guestLastName ?? null,
              platform_guest_phone: res.guestPhone ?? null,
              check_in: res.checkIn,
              check_out: res.checkOut,
              status: res.status,
              adults: res.adults,
              children: res.children,
              total_price: res.totalPrice ?? null,
              currency: res.currency ?? 'EUR',
              city_tax_amount: res.cityTaxAmount ?? null,
              raw_payload: res.rawPayload,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'platform_reservation_id' }
          )

        if (error) {
          console.error(`Failed to upsert reservation ${res.platformReservationId}:`, error)
          totalErrors++
        } else {
          totalUpserted++
        }
      }
    } catch (err) {
      console.error(`Error syncing hotel ${hotelId}:`, err)
      totalErrors++
    }
  }

  // Trigger check-in reminders for reservations 7 days out that haven't been sent yet
  const in7Days = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  const { data: upcoming } = await supabase
    .from('reservations')
    .select('id, check_in, check_out, lock_access_code, lock_access_sent_at, guest_id, property_id')
    .eq('platform', 'booking_com')
    .eq('check_in', in7Days)
    .neq('status', 'cancelled')
    .is('lock_access_sent_at', null)

  for (const reservation of upcoming ?? []) {
    if (!reservation.guest_id) continue

    const { data: guest } = await supabase
      .from('guests')
      .select('email, first_name, last_name')
      .eq('id', reservation.guest_id)
      .single()

    const { data: property } = await supabase
      .from('properties')
      .select('name, address, city')
      .eq('id', reservation.property_id ?? '')
      .single()

    if (!guest?.email || !property || !reservation.lock_access_code) continue

    try {
      await sendCheckinEmail({
        to: guest.email,
        guestName: [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest',
        propertyName: property.name,
        propertyAddress: `${property.address}, ${property.city}`,
        checkIn: reservation.check_in,
        checkOut: reservation.check_out,
        lockPin: reservation.lock_access_code,
      })

      await supabase
        .from('reservations')
        .update({ lock_access_sent_at: new Date().toISOString() })
        .eq('id', reservation.id)
    } catch (err) {
      console.error(`Failed to send check-in email for reservation ${reservation.id}:`, err)
    }
  }

  await logAudit({
    action: 'sync_booking_com',
    resourceType: 'reservation',
  })

  return NextResponse.json({
    success: true,
    upserted: totalUpserted,
    errors: totalErrors,
  })
}
