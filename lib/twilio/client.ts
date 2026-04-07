import twilio from 'twilio'

export async function sendCheckinSms({
  to,
  propertyAddress,
  lockPin,
}: {
  to: string
  propertyAddress: string
  lockPin: string
}) {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )
  return client.messages.create({
    body: `Your check-in PIN: ${lockPin}. Address: ${propertyAddress}. Check-in from 14:00.`,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  })
}
