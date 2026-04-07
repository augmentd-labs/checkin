import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLockProvider } from '@/lib/locks/index'
import { provisionParkingCode } from '@/lib/parking/client'
import { generatePin } from '@/lib/nuki/client'
import { sendCheckinEmail } from '@/lib/resend/templates'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const in35Hours = new Date(now.getTime() + 3.5 * 60 * 60 * 1000)
  const in3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  // Find checked-in reservations with check-in 3–3.5h away, no lock code yet
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      id, check_in, check_out, lock_access_code, parking_access_code,
      properties (
        id, name, address, city,
        nuki_device_id, lockin_device_id,
        lock_provider, parking_enabled, parking_gate_id
      ),
      guests ( email, first_name, last_name )
    `)
    .eq('status', 'checked_in')
    .is('lock_access_code', null)
    .lte('check_in', in35Hours.toISOString().split('T')[0])
    .gte('check_in', in3Hours.toISOString().split('T')[0]) as unknown as {
      data: Array<{
        id: string
        check_in: string
        check_out: string
        lock_access_code: string | null
        parking_access_code: string | null
        properties: {
          id: string
          name: string
          address: string
          city: string
          nuki_device_id: string | null
          lockin_device_id: string | null
          lock_provider: string
          parking_enabled: boolean
          parking_gate_id: string | null
        } | null
        guests: { email: string | null; first_name: string | null; last_name: string | null } | null
      }> | null
      error: { message: string } | null
    }

  if (error) {
    console.error('provision-access-codes: DB error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  let processed = 0
  let failed = 0

  for (const res of reservations ?? []) {
    const property = res.properties
    if (!property) continue

    try {
      const pin = generatePin()
      const deviceId = property.nuki_device_id ?? property.lockin_device_id

      let lockPin: string | null = null

      if (deviceId) {
        const provider = getLockProvider(property.lock_provider)
        await provider.provisionCode({
          deviceId,
          pin,
          name: `Guest-${res.id.slice(0, 8)}`,
          allowedFromDate: `${res.check_in}T14:00:00`,
          allowedUntilDate: `${res.check_out}T12:00:00`,
        })
        lockPin = pin
      }

      let parkingCode: string | null = res.parking_access_code
      if (!parkingCode && property.parking_enabled) {
        parkingCode = await provisionParkingCode(res.id).catch((err: unknown) => {
          console.error(`Parking provisioning failed for ${res.id}:`, err)
          return null
        })
      }

      await supabase
        .from('reservations')
        .update({
          lock_access_code: lockPin,
          lock_access_sent_at: new Date().toISOString(),
          parking_access_code: parkingCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', res.id)

      // Send access codes email
      const guest = res.guests
      if (guest?.email && lockPin) {
        const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest'
        await sendCheckinEmail({
          to: guest.email,
          guestName,
          propertyName: property.name,
          propertyAddress: `${property.address}, ${property.city}`,
          checkIn: res.check_in,
          checkOut: res.check_out,
          lockPin,
          parkingCode: parkingCode ?? undefined,
        }).catch((err: unknown) => {
          console.error(`Email failed for ${res.id}:`, err)
        })
      }

      await logAudit({
        action: 'provision_access_codes',
        resourceType: 'reservation',
        resourceId: res.id,
      })

      processed++
    } catch (err) {
      console.error(`Error provisioning codes for ${res.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ success: true, processed, failed, total: (reservations ?? []).length })
}
