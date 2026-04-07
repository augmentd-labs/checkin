import { Resend } from 'resend'

function resend() {
  return new Resend(process.env.RESEND_API_KEY)
}

// ─── Existing: access codes email (was "checkin email") ───────────────────────

export async function sendCheckinEmail({
  to,
  guestName,
  propertyName,
  propertyAddress,
  checkIn,
  checkOut,
  lockPin,
  parkingCode,
}: {
  to: string
  guestName: string
  propertyName: string
  propertyAddress: string
  checkIn: string
  checkOut: string
  lockPin: string
  parkingCode?: string
}) {
  const parkingSection = parkingCode
    ? `<p><strong>Parking access code:</strong> ${parkingCode}</p>`
    : ''

  return resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Your access codes for ${propertyName}`,
    html: `
      <h1>Your access codes are ready, ${guestName}!</h1>
      <p>Your stay at <strong>${propertyName}</strong> starts soon.</p>
      <p><strong>Address:</strong> ${propertyAddress}</p>
      <p><strong>Check-in:</strong> ${checkIn} at 14:00</p>
      <p><strong>Check-out:</strong> ${checkOut} at 12:00</p>
      <h2>Access</h2>
      <p><strong>Door lock PIN:</strong> <span style="font-size:1.4em;font-weight:bold;letter-spacing:0.1em">${lockPin}</span></p>
      ${parkingSection}
      <p>The PIN is valid from 14:00 on your check-in date until 12:00 on your check-out date.</p>
      <hr />
      <p>If you have any questions, please reply to this email.</p>
    `,
  })
}

// ─── New: check-in invite ─────────────────────────────────────────────────────

export async function sendCheckinInviteEmail({
  to,
  guestName,
  propertyName,
  checkIn,
  checkOut,
  checkinUrl,
}: {
  to: string
  guestName: string
  propertyName: string
  checkIn: string
  checkOut: string
  checkinUrl: string
}) {
  return resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Complete your check-in for ${propertyName} – ${checkIn}`,
    html: `
      <h1>Hi ${guestName}, complete your online check-in</h1>
      <p>Your stay at <strong>${propertyName}</strong> is coming up.</p>
      <p><strong>Check-in:</strong> ${checkIn} at 14:00 &nbsp;|&nbsp; <strong>Check-out:</strong> ${checkOut} at 12:00</p>
      <p>To receive your door access codes and all stay information, please complete your online check-in before arrival:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${checkinUrl}" style="background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:1em">
          Complete Check-in
        </a>
      </p>
      <p>It takes under 2 minutes. You will need your ID document.</p>
      <p>This link is personal to your booking and expires 24 hours after check-out.</p>
      <hr />
      <p style="font-size:0.85em;color:#666">If you already have an account, you can log in at the link above and your booking will be linked automatically.</p>
    `,
  })
}

// ─── New: check-in confirmed (welcome + documents) ───────────────────────────

export async function sendCheckinConfirmedEmail({
  to,
  guestName,
  propertyName,
  propertyAddress,
  checkIn,
  checkOut,
  wifiSsid,
  wifiPassword,
  houseRulesUrl,
}: {
  to: string
  guestName: string
  propertyName: string
  propertyAddress: string
  checkIn: string
  checkOut: string
  wifiSsid?: string
  wifiPassword?: string
  houseRulesUrl?: string
}) {
  const wifiSection = wifiSsid
    ? `
      <h2>WiFi</h2>
      <p><strong>Network:</strong> ${wifiSsid}</p>
      <p><strong>Password:</strong> ${wifiPassword ?? '—'}</p>
    `
    : ''

  const rulesSection = houseRulesUrl
    ? `<p><a href="${houseRulesUrl}">Read the house rules &rarr;</a></p>`
    : ''

  return resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `You're checked in! Everything you need for ${propertyName}`,
    html: `
      <h1>You're all set, ${guestName}!</h1>
      <p>Your check-in for <strong>${propertyName}</strong> has been confirmed.</p>
      <p><strong>Address:</strong> ${propertyAddress}</p>
      <p><strong>Check-in:</strong> ${checkIn} at 14:00 &nbsp;|&nbsp; <strong>Check-out:</strong> ${checkOut} at 12:00</p>
      ${wifiSection}
      ${rulesSection}
      <h2>Access codes</h2>
      <p>Your door PIN and any parking code will be sent to you automatically <strong>3 hours before check-in</strong>.</p>
      <hr />
      <p>If you have any questions, please reply to this email.</p>
    `,
  })
}

// ─── New: check-in rejected ───────────────────────────────────────────────────

export async function sendCheckinRejectedEmail({
  to,
  guestName,
  propertyName,
  checkIn,
  reason,
  contactEmail,
}: {
  to: string
  guestName: string
  propertyName: string
  checkIn: string
  reason: string
  contactEmail: string
}) {
  return resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Action required: check-in issue for your booking at ${propertyName}`,
    html: `
      <h1>Hi ${guestName}, we need to verify your check-in</h1>
      <p>There is an issue with your check-in for <strong>${propertyName}</strong> (arriving ${checkIn}).</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please contact us as soon as possible so we can resolve this before your arrival:</p>
      <p><a href="mailto:${contactEmail}">${contactEmail}</a></p>
      <hr />
      <p style="font-size:0.85em;color:#666">Please do not ignore this message — you will need confirmation before you can access the property.</p>
    `,
  })
}

// ─── Existing: invoice email ──────────────────────────────────────────────────

export async function sendInvoiceEmail({
  to,
  guestName,
  invoiceId,
  pdfBuffer,
}: {
  to: string
  guestName: string
  invoiceId: string
  pdfBuffer: Buffer
}) {
  return resend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Invoice ${invoiceId}`,
    html: `<p>Dear ${guestName},</p><p>Please find your invoice attached.</p>`,
    attachments: [
      {
        filename: `invoice-${invoiceId}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}
