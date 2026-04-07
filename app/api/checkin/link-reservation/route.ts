import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

const LinkSchema = z.object({
  reservationId: z.string().uuid(),
})

/**
 * Links a reservation to the currently authenticated user.
 * Called immediately after account creation or login in the check-in wizard.
 * The reservation was already verified (booking number + last name) in /api/checkin/verify.
 */
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

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: reservation } = await admin
    .from('reservations')
    .select('id, guest_id, status')
    .eq('id', parsed.data.reservationId)
    .single() as unknown as {
      data: { id: string; guest_id: string | null; status: string } | null
    }

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  // Already claimed by a different user
  if (reservation.guest_id && reservation.guest_id !== user.id) {
    return NextResponse.json({ error: 'Reservation belongs to another account' }, { status: 409 })
  }

  if (!reservation.guest_id) {
    await admin.from('guests').upsert({
      id: user.id,
      email: user.email,
      updated_at: new Date().toISOString(),
    })

    await admin
      .from('reservations')
      .update({ guest_id: user.id, updated_at: new Date().toISOString() })
      .eq('id', reservation.id)

    await logAudit({
      actorId: user.id,
      action: 'link_reservation',
      resourceType: 'reservation',
      resourceId: reservation.id,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })
  }

  return NextResponse.json({ success: true })
}
