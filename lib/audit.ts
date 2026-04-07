import { createAdminClient } from '@/lib/supabase/admin'

export async function logAudit({
  actorId,
  action,
  resourceType,
  resourceId,
  ipAddress,
}: {
  actorId?: string
  action: string
  resourceType: string
  resourceId?: string
  ipAddress?: string
}) {
  const supabase = createAdminClient()
  await supabase.from('audit_log').insert({
    actor_id: actorId ?? null,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    ip_address: ipAddress ?? null,
  })
}
