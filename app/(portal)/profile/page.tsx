'use client'

import { useState, useEffect } from 'react'

type IdType = 'passport' | 'national_id'

interface ProfileFormData {
  first_name: string
  last_name: string
  phone: string
  address_street: string
  address_city: string
  address_postal_code: string
  address_country: string
  country_of_residence: string
  id_type: IdType | ''
  id_number: string
  billing_name: string
  billing_address: string
  billing_vat_number: string
  billing_company_id: string
  gdpr_consent: boolean
}

const initialForm: ProfileFormData = {
  first_name: '',
  last_name: '',
  phone: '',
  address_street: '',
  address_city: '',
  address_postal_code: '',
  address_country: '',
  country_of_residence: '',
  id_type: '',
  id_number: '',
  billing_name: '',
  billing_address: '',
  billing_vat_number: '',
  billing_company_id: '',
  gdpr_consent: false,
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileFormData>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasIdEncrypted, setHasIdEncrypted] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        setForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          phone: data.phone ?? '',
          address_street: data.address_street ?? '',
          address_city: data.address_city ?? '',
          address_postal_code: data.address_postal_code ?? '',
          address_country: data.address_country ?? '',
          country_of_residence: data.country_of_residence ?? '',
          id_type: data.id_type ?? '',
          id_number: '',
          billing_name: data.billing_name ?? '',
          billing_address: data.billing_address ?? '',
          billing_vat_number: data.billing_vat_number ?? '',
          billing_company_id: data.billing_company_id ?? '',
          gdpr_consent: data.gdpr_consent ?? false,
        })
        setHasIdEncrypted(!!data.id_number_encrypted)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    if (!form.gdpr_consent) {
      setError('You must consent to data processing to save your profile.')
      setSaving(false)
      return
    }

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save profile')
    } else {
      setSuccess(true)
      if (form.id_number) {
        setHasIdEncrypted(true)
        setForm((prev) => ({ ...prev, id_number: '' }))
      }
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">My Profile</h1>
      <div>
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">Profile saved successfully.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                  First name
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                  Last name
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                  placeholder="+421..."
                />
              </div>
              <div>
                <label htmlFor="country_of_residence" className="block text-sm font-medium text-gray-700">
                  Country of residence
                </label>
                <input
                  type="text"
                  id="country_of_residence"
                  name="country_of_residence"
                  value={form.country_of_residence}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="address_street" className="block text-sm font-medium text-gray-700">
                  Street address
                </label>
                <input
                  type="text"
                  id="address_street"
                  name="address_street"
                  value={form.address_street}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="address_city" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  id="address_city"
                  name="address_city"
                  value={form.address_city}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="address_postal_code" className="block text-sm font-medium text-gray-700">
                  Postal code
                </label>
                <input
                  type="text"
                  id="address_postal_code"
                  name="address_postal_code"
                  value={form.address_postal_code}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="address_country" className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  id="address_country"
                  name="address_country"
                  value={form.address_country}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Identity Document */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Identity Document</h2>
            <p className="text-sm text-gray-500 mb-4">
              Required for check-in registration. Your ID number is encrypted and stored securely.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="id_type" className="block text-sm font-medium text-gray-700">
                  Document type
                </label>
                <select
                  id="id_type"
                  name="id_type"
                  value={form.id_type}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                >
                  <option value="">Select type</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                </select>
              </div>
              <div>
                <label htmlFor="id_number" className="block text-sm font-medium text-gray-700">
                  Document number
                  {hasIdEncrypted && (
                    <span className="ml-2 text-xs text-green-600">(saved — enter new to update)</span>
                  )}
                </label>
                <input
                  type="text"
                  id="id_number"
                  name="id_number"
                  value={form.id_number}
                  onChange={handleChange}
                  placeholder={hasIdEncrypted ? '••••••••' : 'Enter document number'}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Billing Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h2>
            <p className="text-sm text-gray-500 mb-4">
              Optional. Required if you need a VAT invoice.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="billing_name" className="block text-sm font-medium text-gray-700">
                  Billing name / Company
                </label>
                <input
                  type="text"
                  id="billing_name"
                  name="billing_name"
                  value={form.billing_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="billing_vat_number" className="block text-sm font-medium text-gray-700">
                  VAT number
                </label>
                <input
                  type="text"
                  id="billing_vat_number"
                  name="billing_vat_number"
                  value={form.billing_vat_number}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                  placeholder="SK1234567890"
                />
              </div>
              <div>
                <label htmlFor="billing_company_id" className="block text-sm font-medium text-gray-700">
                  Company ID <span className="text-gray-400 font-normal">(IČO, optional)</span>
                </label>
                <input
                  type="text"
                  id="billing_company_id"
                  name="billing_company_id"
                  value={form.billing_company_id}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                  placeholder="12345678"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="billing_address" className="block text-sm font-medium text-gray-700">
                  Billing address
                </label>
                <input
                  type="text"
                  id="billing_address"
                  name="billing_address"
                  value={form.billing_address}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm border px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* GDPR Consent */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Processing Consent</h2>
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="gdpr_consent"
                  name="gdpr_consent"
                  type="checkbox"
                  checked={form.gdpr_consent}
                  onChange={handleChange}
                  className="focus:ring-sky-500 h-4 w-4 text-sky-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="gdpr_consent" className="font-medium text-gray-700">
                  I consent to the processing of my personal data
                </label>
                <p className="text-gray-500 mt-1">
                  Your data is processed in accordance with GDPR and Slovak law. It is used solely
                  for managing your accommodation and legal compliance requirements (e.g., police
                  registration, city tax). You may request deletion at any time.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
