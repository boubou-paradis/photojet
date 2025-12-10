import { NextResponse } from 'next/server'

// Generate ~500KB of random data for speed test
export async function GET() {
  const size = 500 * 1024 // 500KB
  const data = new Uint8Array(size)

  // Fill with random data
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256)
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': size.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
