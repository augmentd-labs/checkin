import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const VerifySchema = z.object({
  platformReservationId: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
})

/** Normalise a phone string to digits only for comparison. */
function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Two-step verification:
 *   1. Booking number lookup — reservation must exist and not be cancelled
 *   2. Last name match (required) — compared against platform_pin
 *   3. Phone handling (option C):
 *        - platform_guest_phone set + entered matches  → verified
 *        - platform_guest_phone set + entered differs  → accepted, flagged for review
 *        - platform_guest_phone null                   → collected only
 *
 * Returns reservation details needed by the wizard on success.
 * Does NOT require the user to be logged in — called before account creation.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { platformReservationId, lastName, phone } = parsed.data

  const admin = createAdminClient()

  const { data: reservation } = await admin
    .from('reservations')
    .select(`
      id, check_in, check_out, adults, children, status,
      platform, platform_pin, platform_guest_phone,
      properties ( name, city )
    `)
    .eq('platform_reservation_id', platformReservationId)
    .neq('status', 'cancelled')
    .single() as unknown as {
      data: {
        id: string
        check_in: string
        check_out: string
        adults: number
        children: number
        status: string
        platform: string
        platform_pin: string | null
        platform_guest_phone: string | null
        properties: { name: string; city: string } | null
      } | null
    }

  if (!reservation) {
    // Intentionally vague — don't reveal whether the ID exists
    return NextResponse.json(
      { error: 'Booking not found. Please check the reservation number and try again.' },
      { status: 404 }
    )
  }

  // Already fully checked in — let them just log in
  if (reservation.status === 'checked_in') {
    return NextResponse.json({ error: 'already_checked_in' }, { status: 409 })
  }
  if (reservation.status === 'checkin_submitted') {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  // Last name is required — must match platform_pin
  if (reservation.platform_pin) {
    const normalise = (s: string) => s.trim().toLowerCase()
    if (normalise(reservation.platform_pin) !== normalise(lastName)) {
      return NextResponse.json(
        { error: 'The last name does not match the booking. Please check and try again.' },
        { status: 403 }
      )
    }
  }

  // Phone — option C adaptive handling
  let phoneStatus: 'verified' | 'unverified' | 'collected' = 'collected'

  if (reservation.platform_guest_phone) {
    const storedDigits = normalisePhone(reservation.platform_guest_phone)
    const enteredDigits = normalisePhone(phone)

    // Compare last 9 digits to handle country-code variations (+421 vs 00421 vs 0421)
    const tail = (s: string) => s.slice(-9)

    if (storedDigits.length >= 7 && tail(storedDigits) === tail(enteredDigits)) {
      phoneStatus = 'verified'
    } else {
      // Phone doesn't match booking — we accept the guest but note it for admin review
      phoneStatus = 'unverified'
    }
  }

  return NextResponse.json({
    reservationId: reservation.id,
    platform: reservation.platform,
    checkIn: reservation.check_in,
    checkOut: reservation.check_out,
    adults: reservation.adults,
    children: reservation.children,
    propertyName: reservation.properties?.name ?? null,
    propertyCity: reservation.properties?.city ?? null,
    phoneStatus,          // 'verified' | 'unverified' | 'collected'
    collectedPhone: phone, // passed back so wizard can pre-fill the details step
  })
}
