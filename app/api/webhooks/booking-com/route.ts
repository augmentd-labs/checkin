import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseReservationsXML } from '@/lib/booking-com/client'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.replace('sha256=', ''), 'hex')
  )
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.NUKI_WEBHOOK_SECRET ?? ''

  const rawBody = await request.text()
  const signature = request.headers.get('x-booking-signature') ?? ''

  // Verify signature if secret is configured
  if (webhookSecret && signature) {
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  try {
    // Booking.com webhooks are XML
    const reservations = parseReservationsXML(rawBody)

    for (const res of reservations) {
      const { error } = await supabase
        .from('reservations')
        .upsert(
          {
            platform: 'booking_com',
            platform_reservation_id: res.platformReservationId,
            platform_pin: res.guestLastName ?? null,
            platform_guest_phone: res.guestPhone ?? null,
            check_in: res.checkIn,
            check_out: res.checkOut,
            status: res.status,
            adults: res.adults,
            children: res.children,
            total_price: res.totalPrice ?? null,
            currency: res.currency ?? 'EUR',
            city_tax_amount: res.cityTaxAmount ?? null,
            raw_payload: res.rawPayload as Json,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'platform_reservation_id' }
        )

      if (error) {
        console.error(`Webhook upsert error for ${res.platformReservationId}:`, error)
      }
    }

    await logAudit({
      action: 'webhook_booking_com',
      resourceType: 'reservation',
    })

    return NextResponse.json({ received: true, count: reservations.length })
  } catch (err) {
    console.error('Booking.com webhook parse error:', err)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 400 })
  }
}
