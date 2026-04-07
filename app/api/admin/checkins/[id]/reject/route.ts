import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { sendCheckinRejectedEmail } from '@/lib/resend/templates'

const RejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { reason } = parsed.data

  const admin = createAdminClient()

  const { data: reservation, error: fetchError } = await admin
    .from('reservations')
    .select(`
      id, check_in, check_out, status,
      properties ( name ),
      guests ( email, first_name, last_name )
    `)
    .eq('id', params.id)
    .single() as unknown as {
      data: {
        id: string
        check_in: string
        check_out: string
        status: string
        properties: { name: string } | null
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

  // Revert to confirmed so the guest can re-submit after fixing the issue
  const { error: updateError } = await admin
    .from('reservations')
    .update({
      status: 'confirmed',
      checkin_submitted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  }

  await logAudit({
    actorId: user.id,
    action: 'reject_checkin',
    resourceType: 'reservation',
    resourceId: reservation.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  // Notify guest
  const guest = reservation.guests
  if (guest?.email) {
    const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest'
    await sendCheckinRejectedEmail({
      to: guest.email,
      guestName,
      propertyName: reservation.properties?.name ?? 'your accommodation',
      checkIn: reservation.check_in,
      reason,
      contactEmail: process.env.RESEND_FROM_EMAIL ?? process.env.ADMIN_EMAIL ?? '',
    }).catch((err: unknown) => {
      console.error('Failed to send rejection email:', err)
    })
  }

  return NextResponse.json({ success: true })
}
