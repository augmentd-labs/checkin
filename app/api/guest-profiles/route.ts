import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import type { InsertTables } from '@/types/database'

const GuestProfileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional().nullable(),
  id_type: z.enum(['passport', 'national_id']).optional().nullable(),
  id_number: z.string().optional(),
  country_of_residence: z.string().optional().nullable(),
})

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('guest_profiles')
    .select('id, first_name, last_name, date_of_birth, id_type, country_of_residence, created_at')
    .eq('account_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GuestProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { id_number, ...fields } = parsed.data
  const insertData: InsertTables<'guest_profiles'> = { ...fields, account_id: user.id }

  if (id_number) {
    insertData.id_number_encrypted = encrypt(id_number)
  }

  const { data, error } = await supabase
    .from('guest_profiles')
    .insert(insertData)
    .select('id, first_name, last_name, date_of_birth, id_type, country_of_residence, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
