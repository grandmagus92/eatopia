// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ModalProvider } from '@/contexts/ModalContext'
import { Modal } from '@/components/Modal'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Eatopia Coffe',
  description: 'Eatopia Coffe and Snack',
  icons: {
    icon: [
      { url: '/images/coffee-icon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <ModalProvider>
          <div className="min-h-screen bg-amber-50">
            {children}
            <Modal />
          </div>
        </ModalProvider>
      </body>
    </html>
  )
}