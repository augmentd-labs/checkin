import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, addDays } from 'date-fns'
import { sendCheckinEmail } from '@/lib/resend/templates'
import { sendCheckinSms } from '@/lib/twilio/client'
import { provisionSmartlockCode, generatePin } from '@/lib/nuki/client'
import { provisionParkingCode } from '@/lib/parking/client'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const in7Days = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  // Find reservations checking in exactly 7 days that haven't had access sent
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, check_in, check_out, guest_id, property_id, lock_access_code, parking_access_code, lock_access_sent_at')
    .eq('check_in', in7Days)
    .neq('status', 'cancelled')
    .is('lock_access_sent_at', null)

  if (error) {
    console.error('Failed to fetch reservations for reminders:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  let processed = 0
  let failed = 0

  for (const reservation of reservations ?? []) {
    if (!reservation.guest_id) continue

    try {
      const [{ data: guest }, { data: property }] = await Promise.all([
        supabase
          .from('guests')
          .select('email, phone, first_name, last_name')
          .eq('id', reservation.guest_id)
          .single(),
        supabase
          .from('properties')
          .select('name, address, city, nuki_device_id, parking_enabled, parking_gate_id')
          .eq('id', reservation.property_id ?? '')
          .single(),
      ])

      if (!guest || !property) {
        console.warn(`Missing guest or property for reservation ${reservation.id}`)
        continue
      }

      let lockPin = reservation.lock_access_code

      // Provision lock if not already done
      if (!lockPin && property.nuki_device_id) {
        const pin = generatePin()
        try {
          await provisionSmartlockCode({
            smartlockId: property.nuki_device_id,
            name: `Guest-${reservation.id.slice(0, 8)}`,
            code: pin,
            allowedFromDate: `${reservation.check_in}T14:00:00`,
            allowedUntilDate: `${reservation.check_out}T12:00:00`,
          })
          lockPin = pin
          await supabase
            .from('reservations')
            .update({ lock_access_code: pin })
            .eq('id', reservation.id)
        } catch (err) {
          console.error(`Failed to provision lock for reservation ${reservation.id}:`, err)
        }
      }

      // Provision parking if enabled and not done
      let parkingCode = reservation.parking_access_code
      if (!parkingCode && property.parking_enabled) {
        try {
          parkingCode = await provisionParkingCode(reservation.id)
          await supabase
            .from('reservations')
            .update({ parking_access_code: parkingCode })
            .eq('id', reservation.id)
        } catch (err) {
          console.error(`Failed to provision parking for reservation ${reservation.id}:`, err)
        }
      }

      if (!lockPin) {
        console.warn(`No lock PIN for reservation ${reservation.id}, skipping notifications`)
        continue
      }

      const guestName =
        [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest'
      const propertyAddress = `${property.address}, ${property.city}`

      // Send email
      if (guest.email) {
        try {
          await sendCheckinEmail({
            to: guest.email,
            guestName,
            propertyName: property.name,
            propertyAddress,
            checkIn: reservation.check_in,
            checkOut: reservation.check_out,
            lockPin,
            parkingCode: parkingCode ?? undefined,
          })
        } catch (err) {
          console.error(`Failed to send email for reservation ${reservation.id}:`, err)
        }
      }

      // Send SMS
      if (guest.phone) {
        try {
          await sendCheckinSms({
            to: guest.phone,
            propertyAddress,
            lockPin,
          })
        } catch (err) {
          console.error(`Failed to send SMS for reservation ${reservation.id}:`, err)
        }
      }

      // Mark as sent
      await supabase
        .from('reservations')
        .update({ lock_access_sent_at: new Date().toISOString() })
        .eq('id', reservation.id)

      await logAudit({
        action: 'send_checkin_reminder',
        resourceType: 'reservation',
        resourceId: reservation.id,
      })

      processed++
    } catch (err) {
      console.error(`Error processing reservation ${reservation.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({
    success: true,
    date: in7Days,
    processed,
    failed,
    total: (reservations ?? []).length,
  })
}
