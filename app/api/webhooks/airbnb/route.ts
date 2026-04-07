import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Not Implemented',
      message:
        'Airbnb webhook handler is pending API approval. Once Airbnb grants connectivity partner access, implement HMAC-SHA256 signature verification and reservation upsert logic.',
    },
    { status: 501 }
  )
}
