import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionSmartlockCode, generatePin } from '@/lib/nuki/client'
import { logAudit } from '@/lib/audit'

const ProvisionSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can provision locks
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ProvisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { reservationId } = parsed.data
  const adminSupabase = createAdminClient()

  const { data: reservation, error: fetchError } = await adminSupabase
    .from('reservations')
    .select('id, check_in, check_out, guest_id, property_id, lock_access_code')
    .eq('id', reservationId)
    .single()

  if (fetchError || !reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  // Get the property's Nuki device ID
  const { data: property } = await adminSupabase
    .from('properties')
    .select('nuki_device_id, name')
    .eq('id', reservation.property_id ?? '')
    .single()

  if (!property?.nuki_device_id) {
    return NextResponse.json(
      { error: 'Property does not have a Nuki device configured' },
      { status: 422 }
    )
  }

  const pin = generatePin()

  // Allowed from 14:00 on check-in to 12:00 on check-out
  const allowedFromDate = `${reservation.check_in}T14:00:00`
  const allowedUntilDate = `${reservation.check_out}T12:00:00`

  try {
    const { id: nukiAuthId } = await provisionSmartlockCode({
      smartlockId: property.nuki_device_id,
      name: `Guest-${reservationId.slice(0, 8)}`,
      code: pin,
      allowedFromDate,
      allowedUntilDate,
    })

    await adminSupabase
      .from('reservations')
      .update({
        lock_access_code: pin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId)

    await logAudit({
      actorId: user.id,
      action: 'provision_lock',
      resourceType: 'reservation',
      resourceId: reservationId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({
      success: true,
      code: pin,
      nukiAuthId,
      allowedFromDate,
      allowedUntilDate,
    })
  } catch (err) {
    console.error('Nuki provisioning error:', err)
    return NextResponse.json({ error: 'Failed to provision lock code' }, { status: 502 })
  }
}
