const NUKI_BASE_URL = 'https://api.nuki.io'

export async function provisionSmartlockCode({
  smartlockId,
  name,
  code,
  allowedFromDate,
  allowedUntilDate,
}: {
  smartlockId: string
  name: string
  code: string
  allowedFromDate: string
  allowedUntilDate: string
}): Promise<{ id: number }> {
  const response = await fetch(`${NUKI_BASE_URL}/smartlock/${smartlockId}/auth`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NUKI_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      code: parseInt(code, 10),
      type: 13, // keypad code
      allowedFromDate,
      allowedUntilDate,
    }),
  })
  if (!response.ok) {
    throw new Error(`Nuki API error: ${response.status}`)
  }
  return response.json() as Promise<{ id: number }>
}

export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
