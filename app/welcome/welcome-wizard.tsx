'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'find' | 'verify' | 'account' | 'details' | 'guests' | 'review' | 'done' | 'pending'

interface VerifiedReservation {
  reservationId: string
  platform: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  propertyName: string | null
  propertyCity: string | null
  phoneStatus: 'verified' | 'unverified' | 'collected'
  collectedPhone: string
}

interface GuestForm {
  firstName: string
  lastName: string
  dateOfBirth: string
  nationality: string
  phone: string
  addressStreet: string
  addressCity: string
  addressPostalCode: string
  addressCountry: string
  idType: 'passport' | 'national_id'
  idNumber: string
}

interface ExistingProfile {
  firstName: string | null
  lastName: string | null
  phone: string | null
  addressStreet: string | null
  addressCity: string | null
  addressPostalCode: string | null
  addressCountry: string | null
  idType: string | null
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const STEPS: Step[] = ['find', 'verify', 'account', 'details', 'guests', 'review']
const STEP_LABELS = ['Booking', 'Identity', 'Account', 'Your details', 'Guests', 'Review']

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current)
  if (idx === -1) return null
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
            i < idx ? 'bg-sky-600 text-white' :
            i === idx ? 'bg-sky-600 text-white ring-2 ring-sky-200' :
            'bg-gray-200 text-gray-500'
          }`}>
            {i < idx
              ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : i + 1}
          </div>
          <span className={`text-xs hidden sm:block whitespace-nowrap ${i === idx ? 'text-sky-700 font-medium' : 'text-gray-400'}`}>{label}</span>
          {i < STEP_LABELS.length - 1 && <div className="w-4 h-px bg-gray-200 mx-0.5" />}
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}

function InputField({ label, id, type = 'text', value, onChange, required, placeholder, autoComplete, hint }: {
  label: string; id: string; type?: string; value: string
  onChange: (v: string) => void; required?: boolean; placeholder?: string
  autoComplete?: string; hint?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} placeholder={placeholder} autoComplete={autoComplete}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SelectField({ label, id, value, onChange, required, children }: {
  label: string; id: string; value: string; onChange: (v: string) => void
  required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
      >
        {children}
      </select>
    </div>
  )
}

function ReservationBanner({ res }: { res: VerifiedReservation }) {
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 mb-6 text-sm">
      <p className="font-semibold text-sky-900">{res.propertyName ?? 'Your accommodation'}</p>
      {res.propertyCity && <p className="text-sky-700 text-xs">{res.propertyCity}</p>}
      <p className="text-sky-700 mt-1">
        {format(new Date(res.checkIn), 'dd MMM yyyy')} &rarr; {format(new Date(res.checkOut), 'dd MMM yyyy')}
        &nbsp;&middot;&nbsp;{res.adults} adult{res.adults !== 1 ? 's' : ''}
        {res.children > 0 ? `, ${res.children} child${res.children !== 1 ? 'ren' : ''}` : ''}
      </p>
    </div>
  )
}

// ─── Step 1: Find booking ─────────────────────────────────────────────────────

function FindStep({ onFound }: { onFound: (bookingNumber: string) => void }) {
  const [bookingNumber, setBookingNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Light pre-check: just confirm it's not empty, actual DB check happens in verify step
    if (!bookingNumber.trim()) {
      setError('Please enter your booking number.')
      setLoading(false)
      return
    }
    onFound(bookingNumber.trim())
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter your booking number to start your online check-in.
        You&apos;ll find it in your Booking.com confirmation email.
      </p>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Booking number" id="bookingNumber" value={bookingNumber}
          onChange={setBookingNumber} required placeholder="e.g. 3456789012"
          autoComplete="off"
        />
        <button type="submit" disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Looking up…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

// ─── Step 2: Verify identity ──────────────────────────────────────────────────

function VerifyStep({
  bookingNumber,
  onVerified,
  onBack,
}: {
  bookingNumber: string
  onVerified: (res: VerifiedReservation) => void
  onBack: () => void
}) {
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/checkin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformReservationId: bookingNumber,
        lastName: lastName.trim(),
        phone: phone.trim(),
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (body.error === 'already_checked_in') {
        setError('This booking is already checked in. Log in to your account to view your stay details.')
      } else if (body.error === 'already_submitted') {
        setError('Your check-in is already submitted and under review.')
      } else {
        setError(body.error ?? 'Verification failed. Please check your details and try again.')
      }
      return
    }

    const data = await res.json() as VerifiedReservation
    onVerified(data)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Confirm your identity</h2>
      <p className="text-sm text-gray-500 mb-2">
        Booking <span className="font-mono font-medium text-gray-700">{bookingNumber}</span>
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Please enter the name used when booking and a phone number we can reach you on.
      </p>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Last name (as on booking)" id="lastName" value={lastName}
          onChange={setLastName} required autoComplete="family-name"
          placeholder="As it appears on your Booking.com confirmation"
        />
        <InputField
          label="Phone number" id="phone" type="tel" value={phone}
          onChange={setPhone} required autoComplete="tel"
          placeholder="+421 901 234 567"
          hint="We use this to send you access codes. Include your country code."
        />
        <button type="submit" disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>
        <button type="button" onClick={onBack}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Different booking number
        </button>
      </form>
    </div>
  )
}

// ─── Step 3: Account ──────────────────────────────────────────────────────────

function AccountStep({
  reservation,
  onDone,
}: {
  reservation: VerifiedReservation
  onDone: () => void
}) {
  const supabase = createClient()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function linkReservation() {
    await fetch('/api/checkin/link-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: reservation.reservationId }),
    })
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    await linkReservation()
    setLoading(false)
    onDone()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) { setError(loginError.message); setLoading(false); return }
    await linkReservation()
    setLoading(false)
    onDone()
  }

  return (
    <div>
      <ReservationBanner res={reservation} />
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        {mode === 'register' ? 'Create your account' : 'Sign in'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {mode === 'register'
          ? 'Your account lets you access stay details, access codes, and invoices at any time.'
          : 'Your booking will be linked to your existing account automatically.'}
      </p>
      {error && <ErrorBox message={error} />}
      <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
        <InputField label="Email address" id="email" type="email" value={email}
          onChange={setEmail} required autoComplete="email" />
        <InputField label="Password" id="password" type="password" value={password}
          onChange={setPassword} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          placeholder={mode === 'register' ? 'Minimum 6 characters' : ''} />
        <button type="submit" disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading
            ? mode === 'register' ? 'Creating account…' : 'Signing in…'
            : mode === 'register' ? 'Create account & continue' : 'Sign in & continue'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        {mode === 'register' ? (
          <>Already have an account?{' '}
            <button onClick={() => setMode('login')} className="text-sky-600 hover:underline font-medium">Sign in</button></>
        ) : (
          <>No account yet?{' '}
            <button onClick={() => setMode('register')} className="text-sky-600 hover:underline font-medium">Create one</button></>
        )}
      </p>
    </div>
  )
}

// ─── Step 4: Guest details ────────────────────────────────────────────────────

function DetailsStep({ form, onChange, onNext }: {
  form: GuestForm
  onChange: (f: Partial<GuestForm>) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Your personal details</h2>
      <p className="text-sm text-gray-500 mb-6">
        Required for legal guest registration. Stored encrypted and handled under GDPR.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); onNext() }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="First name" id="firstName" value={form.firstName}
            onChange={(v) => onChange({ firstName: v })} required autoComplete="given-name" />
          <InputField label="Last name" id="lastName" value={form.lastName}
            onChange={(v) => onChange({ lastName: v })} required autoComplete="family-name" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Date of birth" id="dob" type="date" value={form.dateOfBirth}
            onChange={(v) => onChange({ dateOfBirth: v })} required autoComplete="bday" />
          <InputField label="Nationality" id="nationality" value={form.nationality}
            onChange={(v) => onChange({ nationality: v.toUpperCase() })} required
            placeholder="e.g. SK, DE, US" hint="2-letter country code" />
        </div>
        <InputField label="Phone number" id="phone" type="tel" value={form.phone}
          onChange={(v) => onChange({ phone: v })} required autoComplete="tel" />

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Home address</p>
          <div className="space-y-3">
            <InputField label="Street address" id="street" value={form.addressStreet}
              onChange={(v) => onChange({ addressStreet: v })} required autoComplete="street-address" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <InputField label="City" id="city" value={form.addressCity}
                  onChange={(v) => onChange({ addressCity: v })} required autoComplete="address-level2" />
              </div>
              <InputField label="Postal code" id="postal" value={form.addressPostalCode}
                onChange={(v) => onChange({ addressPostalCode: v })} autoComplete="postal-code" />
            </div>
            <InputField label="Country" id="country" value={form.addressCountry}
              onChange={(v) => onChange({ addressCountry: v.toUpperCase() })} required
              placeholder="e.g. SK, DE, US" hint="2-letter country code" autoComplete="country" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Identity document</p>
          <div className="space-y-3">
            <SelectField label="Document type" id="idType" value={form.idType}
              onChange={(v) => onChange({ idType: v as 'passport' | 'national_id' })} required>
              <option value="passport">Passport</option>
              <option value="national_id">National ID card</option>
            </SelectField>
            <InputField label="Document number" id="idNumber" value={form.idNumber}
              onChange={(v) => onChange({ idNumber: v })} required
              placeholder="As printed on your document" />
          </div>
        </div>

        <button type="submit"
          className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
        >
          Continue
        </button>
      </form>
    </div>
  )
}

// ─── Step 5: Additional guests ────────────────────────────────────────────────

function GuestsStep({ reservation, onNext }: { reservation: VerifiedReservation; onNext: () => void }) {
  const total = reservation.adults + reservation.children
  const extra = Math.max(0, total - 1)
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Additional guests</h2>
      <p className="text-sm text-gray-500 mb-6">
        Your booking is for {total} {total !== 1 ? 'people' : 'person'}.
        {extra > 0
          ? ` You can register up to ${extra} additional guest${extra !== 1 ? 's' : ''} from your account after completing check-in.`
          : ''}
      </p>
      {extra > 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-1">Add travel companions later</p>
          <p>Go to <span className="font-medium">My account &rarr; Guests</span> after completing check-in.</p>
        </div>
      )}
      <button onClick={onNext}
        className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
      >
        Continue to review
      </button>
    </div>
  )
}

// ─── Step 6: Review + GDPR + submit ──────────────────────────────────────────

function ReviewStep({
  reservation, form,
  onSuccess,
}: {
  reservation: VerifiedReservation
  form: GuestForm
  onSuccess: (autoAccepted: boolean) => void
}) {
  const [gdpr, setGdpr] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gdpr) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/checkin/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: reservation.reservationId,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        nationality: form.nationality,
        addressStreet: form.addressStreet,
        addressCity: form.addressCity,
        addressPostalCode: form.addressPostalCode,
        addressCountry: form.addressCountry,
        idType: form.idType,
        idNumber: form.idNumber,
        phone: form.phone,
        gdprConsent: true,
      }),
    })

    setLoading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? 'Submission failed. Please try again.')
      return
    }
    const body = await res.json() as { autoAccepted: boolean }
    onSuccess(body.autoAccepted)
  }

  const summaryRows: [string, string][] = [
    ['Name', `${form.firstName} ${form.lastName}`],
    ['Date of birth', form.dateOfBirth],
    ['Nationality', form.nationality],
    ['Phone', form.phone],
    ['Address', [form.addressStreet, form.addressCity, form.addressPostalCode, form.addressCountry].filter(Boolean).join(', ')],
    ['ID type', form.idType === 'passport' ? 'Passport' : 'National ID'],
    ['ID number', '••••' + form.idNumber.slice(-4)],
  ]

  return (
    <div>
      <ReservationBanner res={reservation} />
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Review & submit</h2>
      <p className="text-sm text-gray-500 mb-4">Please confirm your details before submitting.</p>

      <div className="rounded-lg border border-gray-200 overflow-hidden mb-6">
        {summaryRows.map(([label, value]) => (
          <div key={label} className="flex py-2.5 px-4 even:bg-gray-50 text-sm">
            <span className="w-32 text-gray-500 shrink-0">{label}</span>
            <span className="text-gray-900 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {error && <ErrorBox message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} required
            className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
          <span className="text-sm text-gray-600">
            I consent to the processing of my personal data for guest registration and legal compliance (GDPR).
            My data is stored encrypted and will not be shared with third parties except as required by law.
          </span>
        </label>
        <button type="submit" disabled={!gdpr || loading}
          className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Submitting…' : 'Submit check-in'}
        </button>
      </form>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function WelcomeWizard({
  isLoggedIn,
  existingProfile,
}: {
  isLoggedIn: boolean
  existingProfile: ExistingProfile | null
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('find')
  const [bookingNumber, setBookingNumber] = useState('')
  const [reservation, setReservation] = useState<VerifiedReservation | null>(null)

  const [form, setForm] = useState<GuestForm>({
    firstName: existingProfile?.firstName ?? '',
    lastName: existingProfile?.lastName ?? '',
    dateOfBirth: '',
    nationality: existingProfile?.addressCountry ?? '',
    phone: existingProfile?.phone ?? '',
    addressStreet: existingProfile?.addressStreet ?? '',
    addressCity: existingProfile?.addressCity ?? '',
    addressPostalCode: existingProfile?.addressPostalCode ?? '',
    addressCountry: existingProfile?.addressCountry ?? '',
    idType: (existingProfile?.idType as 'passport' | 'national_id') ?? 'passport',
    idNumber: '',
  })

  function updateForm(partial: Partial<GuestForm>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function handleVerified(res: VerifiedReservation) {
    setReservation(res)
    // Pre-fill phone from verification step
    updateForm({ phone: res.collectedPhone })
    // If already logged in, skip account step
    setStep(isLoggedIn ? 'details' : 'account')
  }

  if (step === 'done') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re checked in!</h1>
        <p className="text-gray-500 text-sm mb-2">
          A confirmation email is on its way with WiFi details and the house rules.
        </p>
        <p className="text-gray-400 text-sm mb-6">
          Your door access code will arrive <strong>3 hours before check-in</strong>.
        </p>
        <button onClick={() => router.push('/dashboard')}
          className="px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
        >
          Go to my bookings
        </button>
      </div>
    )
  }

  if (step === 'pending') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Check-in submitted</h1>
        <p className="text-gray-500 text-sm mb-2">
          Your details are under review. We&apos;ll send a confirmation email once approved — usually within a few hours.
        </p>
        <button onClick={() => router.push('/dashboard')}
          className="mt-4 px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
        >
          Go to my bookings
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
      <StepIndicator current={step} />

      {step === 'find' && (
        <FindStep onFound={(num) => { setBookingNumber(num); setStep('verify') }} />
      )}

      {step === 'verify' && (
        <VerifyStep
          bookingNumber={bookingNumber}
          onVerified={handleVerified}
          onBack={() => setStep('find')}
        />
      )}

      {step === 'account' && reservation && (
        <AccountStep
          reservation={reservation}
          onDone={() => setStep('details')}
        />
      )}

      {step === 'details' && reservation && (
        <>
          <ReservationBanner res={reservation} />
          <DetailsStep form={form} onChange={updateForm} onNext={() => setStep('guests')} />
        </>
      )}

      {step === 'guests' && reservation && (
        <>
          <ReservationBanner res={reservation} />
          <GuestsStep reservation={reservation} onNext={() => setStep('review')} />
        </>
      )}

      {step === 'review' && reservation && (
        <ReviewStep
          reservation={reservation}
          form={form}
          onSuccess={(autoAccepted) => setStep(autoAccepted ? 'done' : 'pending')}
        />
      )}
    </div>
  )
}
