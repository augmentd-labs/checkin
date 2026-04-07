export default function InvoicesPage() {
  return (
    <div className="px-6 py-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Invoices</h1>
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-4 text-slate-500">Invoices will appear here once generated.</p>
        <p className="text-sm text-slate-400 mt-1">
          Complete your billing details in{' '}
          <a href="/profile" className="text-sky-600 hover:text-sky-500">
            your profile
          </a>{' '}
          to receive invoices automatically.
        </p>
      </div>
    </div>
  )
}
