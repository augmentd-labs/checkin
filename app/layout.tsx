import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ReactQueryProvider } from '@/components/providers/react-query-provider'

const inter = Inter({ subsets: ['latin'] })

const propertyName = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? 'Guest Portal'

export const metadata: Metadata = {
  title: `CheckIn | ${propertyName}`,
  description: `Guest portal for ${propertyName}`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  )
}
