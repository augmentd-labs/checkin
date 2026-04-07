import { XMLParser } from 'fast-xml-parser'
import type { Json } from '@/types/database'

const BOOKING_COM_API_BASE = 'https://secure-xml.booking.com/interface/xmlapi.cgi'

interface BookingComReservation {
  platformReservationId: string
  guestLastName: string | null
  guestPhone: string | null
  checkIn: string
  checkOut: string
  status: 'confirmed' | 'cancelled' | 'modified'
  adults: number
  children: number
  totalPrice: number | null
  currency: string | null
  cityTaxAmount: number | null
  rawPayload: Json
}

export async function fetchReservations(hotelId: string): Promise<string> {
  const username = process.env.BOOKING_COM_USERNAME
  const password = process.env.BOOKING_COM_PASSWORD

  if (!username || !password) {
    throw new Error('Booking.com credentials not configured')
  }

  const credentials = Buffer.from(`${username}:${password}`).toString('base64')

  const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${hotelId}</hotel_id>
  <type>reservations</type>
  <date_type>arrival</date_type>
</request>`

  const response = await fetch(BOOKING_COM_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      Authorization: `Basic ${credentials}`,
    },
    body: requestXml,
  })

  if (!response.ok) {
    throw new Error(`Booking.com API error: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

export function parseReservationsXML(xml: string): BookingComReservation[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    parseAttributeValue: true,
  })

  const parsed = parser.parse(xml) as Record<string, unknown>

  // Booking.com XML structure may vary; handle both single and array responses
  const root = parsed['reservations'] ?? parsed['response'] ?? parsed
  const reservationData =
    (root as Record<string, unknown>)?.['reservation'] ??
    (root as Record<string, unknown>)?.['booking'] ??
    []

  const rawList = Array.isArray(reservationData)
    ? reservationData
    : reservationData
    ? [reservationData]
    : []

  return rawList.map((raw: Record<string, unknown>): BookingComReservation => {
    const id = String(
      raw['reservation_id'] ?? raw['booking_id'] ?? raw['id'] ?? ''
    )

    const guestInfo = raw['guest'] as Record<string, unknown> | undefined
    const lastName = guestInfo?.['last_name'] != null ? String(guestInfo['last_name']) : null

    // Phone may appear as guest.phone, guest.telephone, or top-level telephone/phone
    const rawPhone =
      guestInfo?.['phone'] ??
      guestInfo?.['telephone'] ??
      guestInfo?.['mobile'] ??
      raw['telephone'] ??
      raw['phone'] ??
      null
    const guestPhone = rawPhone != null ? String(rawPhone).trim() || null : null

    const checkIn = String(raw['arrival'] ?? raw['check_in'] ?? raw['checkin'] ?? '')
    const checkOut = String(raw['departure'] ?? raw['check_out'] ?? raw['checkout'] ?? '')

    const statusRaw = String(raw['status'] ?? 'confirmed').toLowerCase()
    let status: 'confirmed' | 'cancelled' | 'modified' = 'confirmed'
    if (statusRaw.includes('cancel')) status = 'cancelled'
    else if (statusRaw.includes('modif')) status = 'modified'

    const priceInfo = raw['price'] as Record<string, unknown> | undefined
    const totalPrice = priceInfo?.['total'] != null
      ? Number(priceInfo['total'])
      : raw['total_price'] != null
      ? Number(raw['total_price'])
      : null

    const currency = priceInfo?.['currency'] != null
      ? String(priceInfo['currency'])
      : raw['currency'] != null
      ? String(raw['currency'])
      : null

    const cityTaxAmount = raw['city_tax'] != null ? Number(raw['city_tax']) : null

    const roomInfo = raw['rooms'] as Record<string, unknown> | undefined
    const room = roomInfo?.['room'] as Record<string, unknown> | undefined
    const adults = Number(room?.['adults'] ?? raw['adults'] ?? 1)
    const children = Number(room?.['children'] ?? raw['children'] ?? 0)

    return {
      platformReservationId: id,
      guestLastName: lastName,
      guestPhone,
      checkIn,
      checkOut,
      status,
      adults,
      children,
      totalPrice: totalPrice !== null && !isNaN(totalPrice) ? totalPrice : null,
      currency,
      cityTaxAmount: cityTaxAmount !== null && !isNaN(cityTaxAmount) ? cityTaxAmount : null,
      rawPayload: raw as unknown as Json,
    }
  })
}
