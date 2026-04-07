import { createAdminClient } from '@/lib/supabase/admin'
import type { GuestMessenger } from './index'

/**
 * Fallback messenger: stores the message in pending_messages for an admin to
 * send manually via the Booking.com extranet.
 */
export class QueueMessenger implements GuestMessenger {
  async sendMessage({
    reservationId,
    platformReservationId,
    platform,
    message,
  }: {
    reservationId: string
    platformReservationId: string
    platform: string
    message: string
  }): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase.from('pending_messages').insert({
      reservation_id: reservationId,
      platform,
      platform_reservation_id: platformReservationId,
      message,
    })
    if (error) {
      throw new Error(`Failed to queue message: ${error.message}`)
    }
  }
}
