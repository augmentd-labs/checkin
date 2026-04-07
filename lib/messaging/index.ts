export interface GuestMessenger {
  sendMessage(params: {
    reservationId: string
    platformReservationId: string
    platform: string
    message: string
  }): Promise<void>
}

/**
 * Returns the configured messenger. Falls back to the admin queue when the
 * Booking.com Connectivity API is not yet connected (BOOKING_COM_MESSAGING_API_KEY
 * not set).
 */
export function getMessenger(): GuestMessenger {
  if (process.env.BOOKING_COM_MESSAGING_API_KEY) {
    const { BookingComMessenger } = require('./booking-com') as { BookingComMessenger: new () => GuestMessenger }
    return new BookingComMessenger()
  }
  const { QueueMessenger } = require('./queue') as { QueueMessenger: new () => GuestMessenger }
  return new QueueMessenger()
}
