import { EU_COUNTRIES } from '@/lib/constants'

interface GuestProfile {
  address_city: string | null
  address_country: string | null
}

interface PropertyConfig {
  checkin_review_mode: 'auto' | 'always_review' | 'conditions'
  checkin_review_conditions: {
    cities?: string[]
    countries?: string[]
    non_eu?: boolean
  }
}

/**
 * Returns true if the check-in should be auto-accepted, false if it needs
 * admin review.
 */
export function shouldAutoAccept(
  guest: GuestProfile,
  property: PropertyConfig
): boolean {
  switch (property.checkin_review_mode) {
    case 'auto':
      return true

    case 'always_review':
      return false

    case 'conditions': {
      const { cities, countries, non_eu } = property.checkin_review_conditions

      const guestCity = guest.address_city?.trim().toLowerCase() ?? ''
      const guestCountry = guest.address_country?.trim().toUpperCase() ?? ''

      // Flag if guest lives in one of the configured cities
      if (cities?.some((c) => c.trim().toLowerCase() === guestCity)) {
        return false
      }

      // Flag if guest's country is in the configured list
      if (countries?.some((c) => c.trim().toUpperCase() === guestCountry)) {
        return false
      }

      // Flag non-EU travellers if configured
      if (non_eu && guestCountry && !EU_COUNTRIES.has(guestCountry)) {
        return false
      }

      return true
    }

    default:
      return false
  }
}
