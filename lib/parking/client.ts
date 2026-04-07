// Parking gate integration — stub until hardware is installed
// Hardware: GSM relay module (e.g. Waveshare SIM relay)
// The relay will expose an HTTP endpoint or accept SMS commands via Twilio

export async function provisionParkingCode(_reservationId: string): Promise<string> {
  // TODO: implement after hardware installation
  // Option A: POST to relay HTTP endpoint on local network / VPN
  // Option B: Twilio sends SMS command to relay's SIM number
  console.warn('Parking gate integration is not yet implemented')
  return 'PARKING-STUB'
}
