import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/portal/sidebar'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let guestName: string | null = null
  if (user) {
    const { data } = await supabase
      .from('guests')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single() as unknown as { data: { first_name: string | null; last_name: string | null } | null }
    if (data?.first_name) {
      guestName = [data.first_name, data.last_name].filter(Boolean).join(' ')
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar guestName={guestName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
