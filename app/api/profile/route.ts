import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { logAudit } from '@/lib/audit'

const ProfileUpdateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_postal_code: z.string().optional(),
  address_country: z.string().optional(),
  country_of_residence: z.string().optional(),
  id_type: z.enum(['passport', 'national_id']).optional().nullable(),
  id_number: z.string().optional(),
  billing_name: z.string().optional(),
  billing_address: z.string().optional(),
  billing_vat_number: z.string().optional(),
  billing_company_id: z.string().optional(),
  gdpr_consent: z.boolean().optional(),
})

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: guest, error } = await supabase
    .from('guests')
    .select(
      'id, first_name, last_name, email, phone, id_number_encrypted, id_type, address_street, address_city, address_postal_code, address_country, country_of_residence, billing_name, billing_address, billing_vat_number, billing_company_id, gdpr_consent, gdpr_consent_at'
    )
    .eq('id', user.id)
    .single()

  if (error || !guest) {
    // Return empty profile if not yet created
    return NextResponse.json({ id: user.id, email: user.email })
  }

  // Never return the raw encrypted value to the client, just a presence flag
  const { id_number_encrypted, ...rest } = guest
  return NextResponse.json({ ...rest, id_number_encrypted: id_number_encrypted ? true : null })
}

export async function PATCH(request: NextRequest) {
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

  const parsed = ProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { id_number, gdpr_consent, ...fields } = parsed.data

  // Build update object
  const updateData: Record<string, unknown> = {
    ...fields,
    email: user.email,
    updated_at: new Date().toISOString(),
  }

  if (id_number && id_number.trim().length > 0) {
    updateData.id_number_encrypted = encrypt(id_number.trim())
  }

  if (gdpr_consent !== undefined) {
    updateData.gdpr_consent = gdpr_consent
    if (gdpr_consent) {
      updateData.gdpr_consent_at = new Date().toISOString()
    }
  }

  const { error } = await supabase
    .from('guests')
    .upsert({ id: user.id, ...updateData })

  if (error) {
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }

  await logAudit({
    actorId: user.id,
    action: 'update_profile',
    resourceType: 'guest',
    resourceId: user.id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ success: true })
}
