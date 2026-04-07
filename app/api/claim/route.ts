import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const ClaimSchema = z.object({
  platform: z.enum(['booking_com', 'airbnb', 'direct']),
  reservationId: z.string().min(1, 'Reservation ID is required'),
  lastName: z.string().min(1, 'Last name is required'),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ClaimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { platform, reservationId, lastName } = parsed.data

  // Look up the reservation by platform + platform_reservation_id
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('id, guest_id, platform_pin')
    .eq('platform', platform)
    .eq('platform_reservation_id', reservationId)
    .single() as unknown as { data: { id: string; guest_id: string | null; platform_pin: string | null } | null; error: { message: string } | null }

  if (fetchError || !reservation) {
    return NextResponse.json(
      { error: 'Reservation not found. Please check your platform and reservation ID.' },
      { status: 404 }
    )
  }

  // Validate last name against platform_pin or guest last name
  // platform_pin stores the last name provided at time of booking for verification
  if (reservation.platform_pin) {
    const normalized = (s: string) => s.trim().toLowerCase()
    if (normalized(reservation.platform_pin) !== normalized(lastName)) {
      return NextResponse.json(
        { error: 'Last name does not match. Please check the name on your booking.' },
        { status: 403 }
      )
    }
  } else {
    // Fall back to checking the guest record if already linked
    if (reservation.guest_id) {
      const { data: guest } = await supabase
        .from('guests')
        .select('last_name')
        .eq('id', reservation.guest_id)
        .single() as unknown as { data: { last_name: string | null } | null }

      if (guest?.last_name) {
        const normalized = (s: string) => s.trim().toLowerCase()
        if (normalized(guest.last_name) !== normalized(lastName)) {
          return NextResponse.json(
            { error: 'Last name does not match. Please check the name on your booking.' },
            { status: 403 }
          )
        }
      }
    }
  }

  // Check if already claimed by a different user
  if (reservation.guest_id && reservation.guest_id !== user.id) {
    return NextResponse.json(
      { error: 'This reservation is already linked to another account.' },
      { status: 409 }
    )
  }

  // Upsert guest record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('guests') as any).upsert({
    id: user.id,
    email: user.email,
    updated_at: new Date().toISOString(),
  })

  // Link reservation to this guest
  const { error: updateError } = await supabase
    .from('reservations')
    .update({ guest_id: user.id, updated_at: new Date().toISOString() })
    .eq('id', reservation.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to link reservation.' }, { status: 500 })
  }

  await logAudit({
    actorId: user.id,
    action: 'claim_reservation',
    resourceType: 'reservation',
    resourceId: reservation.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ success: true, reservationId: reservation.id })
}
