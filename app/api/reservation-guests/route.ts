import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const LinkSchema = z.object({
  reservation_id: z.string().uuid(),
  guest_profile_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  // Verify guest owns both the reservation and the guest profile
  const [{ data: reservation }, { data: member }] = await Promise.all([
    supabase.from('reservations').select('id').eq('id', parsed.data.reservation_id).eq('guest_id', user.id).single(),
    supabase.from('guest_profiles').select('id').eq('id', parsed.data.guest_profile_id).eq('account_id', user.id).single(),
  ])

  if (!reservation || !member) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase.from('reservation_guests').insert(parsed.data)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  // Verify ownership via reservation
  const { data: reservation } = await supabase
    .from('reservations').select('id').eq('id', parsed.data.reservation_id).eq('guest_id', user.id).single()
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('reservation_guests')
    .delete()
    .eq('reservation_id', parsed.data.reservation_id)
    .eq('guest_profile_id', parsed.data.guest_profile_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
