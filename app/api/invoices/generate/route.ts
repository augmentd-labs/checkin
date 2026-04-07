import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvoiceEmail } from '@/lib/resend/templates'
import { logAudit } from '@/lib/audit'

const GenerateInvoiceSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can generate invoices
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GenerateInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { reservationId } = parsed.data
  const adminSupabase = createAdminClient()

  // Fetch reservation
  const { data: reservation, error: reservationError } = await adminSupabase
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .single()

  if (reservationError || !reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (reservation.invoice_id) {
    return NextResponse.json(
      { error: 'Invoice already generated', invoiceId: reservation.invoice_id },
      { status: 409 }
    )
  }

  // Fetch guest billing info
  const { data: guest } = await adminSupabase
    .from('guests')
    .select('email, first_name, last_name, billing_name, billing_address, billing_vat_number')
    .eq('id', reservation.guest_id ?? '')
    .single()

  if (!guest?.email) {
    return NextResponse.json({ error: 'Guest email not found' }, { status: 422 })
  }

  // Fetch property
  const { data: property } = await adminSupabase
    .from('properties')
    .select('name, address, city')
    .eq('id', reservation.property_id ?? '')
    .single()

  // Post to accounting API
  const accountingApiUrl = process.env.ACCOUNTING_API_URL
  const accountingApiKey = process.env.ACCOUNTING_API_KEY

  if (!accountingApiUrl || !accountingApiKey) {
    return NextResponse.json({ error: 'Accounting API not configured' }, { status: 500 })
  }

  let invoiceId: string
  let pdfBuffer: Buffer

  try {
    const accountingRes = await fetch(`${accountingApiUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accountingApiKey}`,
      },
      body: JSON.stringify({
        reservation_id: reservationId,
        platform: reservation.platform,
        platform_reservation_id: reservation.platform_reservation_id,
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        total_price: reservation.total_price,
        city_tax_amount: reservation.city_tax_amount,
        currency: reservation.currency,
        adults: reservation.adults,
        children: reservation.children,
        property_name: property?.name,
        property_address: property ? `${property.address}, ${property.city}` : undefined,
        billing_name: guest.billing_name,
        billing_address: guest.billing_address,
        billing_vat_number: guest.billing_vat_number,
        guest_name: [guest.first_name, guest.last_name].filter(Boolean).join(' '),
        guest_email: guest.email,
      }),
    })

    if (!accountingRes.ok) {
      const errText = await accountingRes.text()
      console.error('Accounting API error:', errText)
      return NextResponse.json({ error: 'Failed to generate invoice in accounting system' }, { status: 502 })
    }

    const accountingData = await accountingRes.json() as { invoice_id: string; pdf_url: string }
    invoiceId = accountingData.invoice_id

    // Download PDF
    const pdfRes = await fetch(accountingData.pdf_url, {
      headers: { 'Authorization': `Bearer ${accountingApiKey}` },
    })
    pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  } catch (err) {
    console.error('Accounting API request failed:', err)
    return NextResponse.json({ error: 'Failed to connect to accounting system' }, { status: 502 })
  }

  // Store invoice ID
  await adminSupabase
    .from('reservations')
    .update({
      invoice_id: invoiceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)

  // Email PDF via Resend
  try {
    await sendInvoiceEmail({
      to: guest.email,
      guestName: [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest',
      invoiceId,
      pdfBuffer,
    })

    await adminSupabase
      .from('reservations')
      .update({ invoice_sent_at: new Date().toISOString() })
      .eq('id', reservationId)
  } catch (err) {
    console.error('Failed to send invoice email:', err)
    // Non-fatal: invoice is already stored
  }

  await logAudit({
    actorId: user.id,
    action: 'generate_invoice',
    resourceType: 'reservation',
    resourceId: reservationId,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ success: true, invoiceId })
}
