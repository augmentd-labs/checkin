import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/encryption'
import { logAudit } from '@/lib/audit'
import { shouldAutoAccept } from '@/lib/checkin/auto-accept'
import { sendCheckinConfirmedEmail } from '@/lib/resend/templates'

const SubmitSchema = z.object({
  reservationId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  nationality: z.string().min(2).max(2),    // ISO alpha-2
  addressStreet: z.string().min(1),
  addressCity: z.string().min(1),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().min(2).max(2),  // ISO alpha-2
  idType: z.enum(['passport', 'national_id']),
  idNumber: z.string().min(1),
  phone: z.string().min(1),
  gdprConsent: z.literal(true),
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

  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const {
    reservationId,
    firstName, lastName, dateOfBirth, nationality,
    addressStreet, addressCity, addressPostalCode, addressCountry,
    idType, idNumber, phone, gdprConsent,
  } = parsed.data

  const admin = createAdminClient()

  // Reservation must be linked to this user (established during the account step)
  const { data: reservation } = await admin
    .from('reservations')
    .select(`
      id, check_in, check_out, status, guest_id,
      properties (
        name, address, city, wifi_ssid, wifi_password, house_rules_url,
        checkin_review_mode, checkin_review_conditions
      )
    `)
    .eq('id', reservationId)
    .eq('guest_id', user.id)
    .single() as unknown as {
      data: {
        id: string
        check_in: string
        check_out: string
        status: string
        guest_id: string
        properties: {
          name: string
          address: string
          city: string
          wifi_ssid: string | null
          wifi_password: string | null
          house_rules_url: string | null
          checkin_review_mode: 'auto' | 'always_review' | 'conditions'
          checkin_review_conditions: { cities?: string[]; countries?: string[]; non_eu?: boolean }
        } | null
      } | null
    }

  if (!reservation) {
    return NextResponse.json(
      { error: 'Reservation not found or not linked to your account' },
      { status: 404 }
    )
  }

  if (!['confirmed', 'modified'].includes(reservation.status)) {
    return NextResponse.json({ error: 'Reservation already processed' }, { status: 409 })
  }

  // Upsert guest profile with all provided details
  await admin.from('guests').upsert({
    id: user.id,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    phone,
    address_street: addressStreet,
    address_city: addressCity,
    address_postal_code: addressPostalCode ?? null,
    address_country: addressCountry,
    country_of_residence: addressCountry,
    id_type: idType,
    id_number_encrypted: encrypt(idNumber),
    gdpr_consent: gdprConsent,
    gdpr_consent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  // Auto-accept decision
  const property = reservation.properties
  const autoAccept = shouldAutoAccept(
    { address_city: addressCity, address_country: addressCountry },
    property ?? { checkin_review_mode: 'auto', checkin_review_conditions: {} }
  )
  const newStatus = autoAccept ? 'checked_in' : 'checkin_submitted'

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    checkin_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (autoAccept) {
    updatePayload.checkin_accepted_at = new Date().toISOString()
  }

  await admin.from('reservations').update(updatePayload).eq('id', reservationId)

  await logAudit({
    actorId: user.id,
    action: 'submit_checkin',
    resourceType: 'reservation',
    resourceId: reservationId,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  if (autoAccept && user.email && property) {
    sendCheckinConfirmedEmail({
      to: user.email,
      guestName: `${firstName} ${lastName}`.trim(),
      propertyName: property.name,
      propertyAddress: `${property.address}, ${property.city}`,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      wifiSsid: property.wifi_ssid ?? undefined,
      wifiPassword: property.wifi_password ?? undefined,
      houseRulesUrl: property.house_rules_url ?? undefined,
    }).catch((err: unknown) => console.error('Confirmation email failed:', err))
  }

  return NextResponse.json({ success: true, status: newStatus, autoAccepted: autoAccept })
}
