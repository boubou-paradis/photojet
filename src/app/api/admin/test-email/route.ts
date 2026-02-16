// Test endpoint - sends renewal email directly to verify Resend works
// Usage: GET /api/admin/test-email?email=mg.events35@gmail.com&secret=ADMIN_SECRET_PIN

import { NextRequest, NextResponse } from 'next/server'
import { sendRenewalConfirmationEmail } from '@/lib/resend'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const email = request.nextUrl.searchParams.get('email')

  // Protected by ADMIN_SECRET_PIN (available in .env)
  if (!secret || secret !== process.env.ADMIN_SECRET_PIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Missing email param' }, { status: 400 })
  }

  console.log(`[Test Email] Sending renewal confirmation to ${email}`)

  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  try {
    const result = await sendRenewalConfirmationEmail({
      to: email,
      nextBillingDate: nextMonth.toISOString(),
    })

    console.log(`[Test Email] Result:`, JSON.stringify(result))

    return NextResponse.json({
      success: true,
      emailResult: result,
      sentTo: email,
      nextBillingDate: nextMonth.toISOString(),
    })
  } catch (error) {
    console.error(`[Test Email] Error:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
