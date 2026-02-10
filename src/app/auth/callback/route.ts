import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // ignore in Server Component context
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
    }

    // HTML redirect to ensure cookies propagate
    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/admin"><title>Redirecting...</title></head><body><script>window.location.href='/admin';</script></body></html>`
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
