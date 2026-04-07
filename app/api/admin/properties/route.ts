import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  const { data: properties, error } = await adminSupabase
    .from('properties')
    .select('id, name, city, address')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 })
  }

  return NextResponse.json(properties ?? [])
}
