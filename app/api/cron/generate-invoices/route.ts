import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvoiceEmail } from '@/lib/resend/templates'
import { logAudit } from '@/lib/audit'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Find today's checked-in reservations without an invoice yet
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      id, check_in, check_out, total_price, currency, city_tax_amount,
      platform_reservation_id, platform,
      guests ( email, first_name, last_name, billing_name, billing_address, billing_vat_number ),
      properties ( name, city )
    `)
    .eq('check_in', today)
    .eq('status', 'checked_in')
    .is('invoice_id', null) as unknown as {
      data: Array<{
        id: string
        check_in: string
        check_out: string
        total_price: number | null
        currency: string
        city_tax_amount: number | null
        platform_reservation_id: string
        platform: string
        guests: {
          email: string | null
          first_name: string | null
          last_name: string | null
          billing_name: string | null
          billing_address: string | null
          billing_vat_number: string | null
        } | null
        properties: { name: string; city: string } | null
      }> | null
      error: { message: string } | null
    }

  if (error) {
    console.error('generate-invoices: DB error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const accountingApiUrl = process.env.ACCOUNTING_API_URL
  const accountingApiKey = process.env.ACCOUNTING_API_KEY

  let processed = 0
  let failed = 0
  let skipped = 0

  for (const res of reservations ?? []) {
    if (!accountingApiUrl || !accountingApiKey) {
      console.warn('generate-invoices: ACCOUNTING_API_URL not configured, skipping')
      skipped++
      continue
    }

    const guest = res.guests
    if (!guest?.email) {
      skipped++
      continue
    }

    try {
      // Call accounting API to generate invoice
      const invoiceResponse = await fetch(`${accountingApiUrl}/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accountingApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: res.id,
          platformReservationId: res.platform_reservation_id,
          checkIn: res.check_in,
          checkOut: res.check_out,
          totalPrice: res.total_price,
          currency: res.currency,
          cityTax: res.city_tax_amount,
          propertyName: res.properties?.name,
          billingName: guest.billing_name ?? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim(),
          billingAddress: guest.billing_address,
          billingVat: guest.billing_vat_number,
        }),
      })

      if (!invoiceResponse.ok) {
        throw new Error(`Accounting API error: ${invoiceResponse.status}`)
      }

      const invoiceData = await invoiceResponse.json() as { id: string; pdf?: string }

      // Store invoice ID
      await supabase
        .from('reservations')
        .update({
          invoice_id: invoiceData.id,
          invoice_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', res.id)

      // Send invoice PDF if available
      if (invoiceData.pdf && guest.email) {
        const pdfBuffer = Buffer.from(invoiceData.pdf, 'base64')
        const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Guest'
        await sendInvoiceEmail({
          to: guest.email,
          guestName,
          invoiceId: invoiceData.id,
          pdfBuffer,
        }).catch((err: unknown) => {
          console.error(`Invoice email failed for ${res.id}:`, err)
        })
      }

      await logAudit({
        action: 'generate_invoice',
        resourceType: 'reservation',
        resourceId: res.id,
      })

      processed++
    } catch (err) {
      console.error(`Error generating invoice for ${res.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    skipped,
    total: (reservations ?? []).length,
  })
}
