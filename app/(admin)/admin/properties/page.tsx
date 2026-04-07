import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import type { Tables } from '@/types/database'

export default async function AdminPropertiesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/dashboard')

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, address, city, nuki_device_id, lockin_device_id, parking_enabled, parking_gate_id, created_at')
    .order('name', { ascending: true }) as unknown as { data: Tables<'properties'>[] | null }

  return (
    <div className="px-6 py-8 max-w-7xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Properties</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(properties ?? []).map((property) => (
          <div key={property.id} className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{property.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{property.address}</p>
                <p className="text-sm text-gray-500">{property.city}</p>
              </div>
              {property.parking_enabled && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Parking
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Nuki Device ID</span>
                <span className="font-mono text-gray-900 text-xs">
                  {property.nuki_device_id ?? <span className="text-gray-400 italic">not configured</span>}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Lockin Device ID</span>
                <span className="font-mono text-gray-900 text-xs">
                  {property.lockin_device_id ?? <span className="text-gray-400 italic">not configured</span>}
                </span>
              </div>
              {property.parking_enabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Parking Gate ID</span>
                  <span className="font-mono text-gray-900 text-xs">
                    {property.parking_gate_id ?? <span className="text-gray-400 italic">not configured</span>}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Added {format(new Date(property.created_at), 'dd MMM yyyy')}
              </p>
            </div>
          </div>
        ))}

        {(properties ?? []).length === 0 && (
          <div className="col-span-3 bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-500">No properties configured yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
