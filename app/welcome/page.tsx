import { createClient } from '@/lib/supabase/server'
import WelcomeWizard from './welcome-wizard'

export default async function WelcomePage() {
  // Pass existing session if the guest is already logged in — wizard can skip account step
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let existingProfile: {
    firstName: string | null
    lastName: string | null
    phone: string | null
    addressStreet: string | null
    addressCity: string | null
    addressPostalCode: string | null
    addressCountry: string | null
    idType: string | null
  } | null = null

  if (user) {
    const { data: guest } = await supabase
      .from('guests')
      .select('first_name, last_name, phone, address_street, address_city, address_postal_code, address_country, id_type')
      .eq('id', user.id)
      .single() as unknown as {
        data: {
          first_name: string | null
          last_name: string | null
          phone: string | null
          address_street: string | null
          address_city: string | null
          address_postal_code: string | null
          address_country: string | null
          id_type: string | null
        } | null
      }

    if (guest) {
      existingProfile = {
        firstName: guest.first_name,
        lastName: guest.last_name,
        phone: guest.phone,
        addressStreet: guest.address_street,
        addressCity: guest.address_city,
        addressPostalCode: guest.address_postal_code,
        addressCountry: guest.address_country,
        idType: guest.id_type,
      }
    }
  }

  return (
    <WelcomeWizard
      isLoggedIn={!!user}
      existingProfile={existingProfile}
    />
  )
}
