import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'

const GuestProfileUpdateSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  date_of_birth: z.string().optional().nullable(),
  id_type: z.enum(['passport', 'national_id']).optional().nullable(),
  id_number: z.string().optional(),
  country_of_residence: z.string().optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GuestProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { id_number, ...fields } = parsed.data
  const updateData: Record<string, unknown> = { ...fields }
  if (id_number) updateData.id_number_encrypted = encrypt(id_number)

  const { data, error } = await supabase
    .from('guest_profiles')
    .update(updateData)
    .eq('id', params.id)
    .eq('account_id', user.id)
    .select('id, first_name, last_name, date_of_birth, id_type, country_of_residence, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('guest_profiles')
    .delete()
    .eq('id', params.id)
    .eq('account_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
