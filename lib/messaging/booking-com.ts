import type { GuestMessenger } from './index'

/**
 * Booking.com Connectivity API messenger.
 * Requires BOOKING_COM_MESSAGING_API_KEY to be set.
 *
 * Replace the fetch call body/URL once the exact Connectivity API endpoint
 * is confirmed with the middleman partner.
 */
export class BookingComMessenger implements GuestMessenger {
  async sendMessage({
    platformReservationId,
    message,
  }: {
    reservationId: string
    platformReservationId: string
    platform: string
    message: string
  }): Promise<void> {
    const response = await fetch(
      `https://distribution-xml.booking.com/json/bookings/${platformReservationId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.BOOKING_COM_MESSAGING_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    )
    if (!response.ok) {
      throw new Error(`Booking.com messaging error: ${response.status}`)
    }
  }
}
