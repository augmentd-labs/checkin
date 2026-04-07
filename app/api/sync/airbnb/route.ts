import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      error: 'Not Implemented',
      message:
        'Airbnb API sync is pending API approval from Airbnb. Once approved, implement using the Airbnb Connectivity API with client credentials OAuth flow.',
    },
    { status: 501 }
  )
}
