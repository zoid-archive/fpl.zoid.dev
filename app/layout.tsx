import Script from 'next/script'
import 'tailwindcss/tailwind.css'

import { Providers } from './Providers'
import './globals.css'
import { Menu } from './sections/Menu'

const SQL_WASM_JS_PATH = '/assets/sql.js/1.8.0/sql-wasm.js'

export const metadata = {
  title: 'FPL.lol — analyse fantasy premier league data with SQL',
  description:
    'Query Fantasy Premier League data with SQL, right in your browser — no backend, no signup.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* The favicon is served from app/favicon.ico by the Next.js
            app-router convention. */}
        <Script src={SQL_WASM_JS_PATH}></Script>
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
            <Menu />
            <main className="mt-4 w-full">{children}</main>
            <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
              <span>
                FPL.lol — Fantasy Premier League data, queried with SQL.
              </span>
              <a
                href="https://trackfootball.app"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Made with ♥ · TrackFootball.app
              </a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
