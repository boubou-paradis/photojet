import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'

const COMPANY_INFO = {
  name: 'MG Events Animation',
  owner: 'Guillaume Morel',
  address: '10 Lan Lande des Couedies',
  city: '35600 Bains-sur-Oust',
  siret: '499 112 308 00030',
  email: 'mg.events35@gmail.com',
  phone: '06 48 10 61 66',
}

const PRICE = 29.90
const PRODUCT_DESCRIPTION = 'Abonnement AnimaJet - 1 mois'

interface InvoiceData {
  invoiceNumber: string
  date: Date
  customerName: string
  customerEmail: string
  amount: number
  stripePaymentId?: string
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function formatPrice(amount: number): string {
  return amount.toFixed(2).replace('.', ',') + ' €'
}

export async function generateInvoiceNumber(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const year = new Date().getFullYear()

  // Get the last invoice number for this year
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `AJ-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .single()

  let nextNumber = 1
  if (lastInvoice?.invoice_number) {
    const match = lastInvoice.invoice_number.match(/AJ-\d{4}-(\d{4})/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `AJ-${year}-${nextNumber.toString().padStart(4, '0')}`
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const { width, height } = page.getSize()

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const gold = rgb(212 / 255, 175 / 255, 55 / 255)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)

  let y = height - 50

  // Header - Title "FACTURE"
  page.drawText('FACTURE', {
    x: width / 2 - 50,
    y,
    size: 28,
    font: fontBold,
    color: gold,
  })

  y -= 40

  // Invoice number and date
  page.drawText(`Facture N° ${data.invoiceNumber}`, {
    x: 50,
    y,
    size: 12,
    font: fontBold,
    color: black,
  })

  page.drawText(`Date : ${formatDate(data.date)}`, {
    x: width - 150,
    y,
    size: 11,
    font: fontRegular,
    color: gray,
  })

  y -= 50

  // Separator line
  page.drawLine({
    start: { x: 50, y: y + 10 },
    end: { x: width - 50, y: y + 10 },
    thickness: 1,
    color: gold,
  })

  y -= 20

  // Emitter (left)
  page.drawText('EMETTEUR', {
    x: 50,
    y,
    size: 10,
    font: fontBold,
    color: gold,
  })

  // Client (right)
  page.drawText('CLIENT', {
    x: width - 200,
    y,
    size: 10,
    font: fontBold,
    color: gold,
  })

  y -= 20

  // Emitter details
  const emitterLines = [
    COMPANY_INFO.name,
    COMPANY_INFO.owner,
    COMPANY_INFO.address,
    COMPANY_INFO.city,
    '',
    `SIRET : ${COMPANY_INFO.siret}`,
    `Email : ${COMPANY_INFO.email}`,
    `Tel : ${COMPANY_INFO.phone}`,
  ]

  let emitterY = y
  for (const line of emitterLines) {
    if (line) {
      page.drawText(line, {
        x: 50,
        y: emitterY,
        size: 10,
        font: fontRegular,
        color: black,
      })
    }
    emitterY -= 15
  }

  // Client details
  const clientLines = [
    data.customerName || 'Client',
    data.customerEmail,
  ]

  let clientY = y
  for (const line of clientLines) {
    if (line) {
      page.drawText(line, {
        x: width - 200,
        y: clientY,
        size: 10,
        font: fontRegular,
        color: black,
      })
    }
    clientY -= 15
  }

  y -= 140

  // Table header
  const tableTop = y
  const tableLeft = 50
  const tableRight = width - 50
  const colDescX = 55
  const colPriceX = width - 100

  // Table header background
  page.drawRectangle({
    x: tableLeft,
    y: tableTop - 5,
    width: tableRight - tableLeft,
    height: 25,
    color: gold,
  })

  page.drawText('Description', {
    x: colDescX,
    y: tableTop,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  page.drawText('Prix', {
    x: colPriceX,
    y: tableTop,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  y = tableTop - 35

  // Table row - Product
  page.drawRectangle({
    x: tableLeft,
    y: y - 5,
    width: tableRight - tableLeft,
    height: 25,
    color: lightGray,
  })

  page.drawText(PRODUCT_DESCRIPTION, {
    x: colDescX,
    y,
    size: 10,
    font: fontRegular,
    color: black,
  })

  page.drawText(formatPrice(data.amount), {
    x: colPriceX,
    y,
    size: 10,
    font: fontRegular,
    color: black,
  })

  y -= 35

  // Total row
  page.drawRectangle({
    x: tableLeft,
    y: y - 5,
    width: tableRight - tableLeft,
    height: 30,
    color: gold,
  })

  page.drawText('TOTAL', {
    x: colDescX,
    y: y + 2,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  page.drawText(formatPrice(data.amount), {
    x: colPriceX,
    y: y + 2,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  y -= 60

  // TVA notice
  page.drawText('TVA non applicable, article 293 B du CGI', {
    x: 50,
    y,
    size: 10,
    font: fontRegular,
    color: gray,
  })

  y -= 40

  // Footer - Thank you message
  page.drawLine({
    start: { x: 50, y: y + 10 },
    end: { x: width - 50, y: y + 10 },
    thickness: 1,
    color: lightGray,
  })

  y -= 20

  page.drawText('Merci pour votre confiance !', {
    x: width / 2 - 70,
    y,
    size: 12,
    font: fontBold,
    color: gold,
  })

  // Bottom footer
  const footerY = 40
  page.drawText('AnimaJet - MG Events Animation', {
    x: width / 2 - 80,
    y: footerY,
    size: 9,
    font: fontRegular,
    color: gray,
  })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

export async function saveInvoice(params: {
  userId: string
  invoiceNumber: string
  amount: number
  stripePaymentId?: string
  pdfBuffer: Uint8Array
}): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Supabase credentials not configured' }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Upload PDF to storage
    const fileName = `${params.invoiceNumber}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, params.pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('[Invoice] Storage upload error:', uploadError)
      // Continue even if storage fails - the PDF will still be sent by email
    }

    // Save invoice record
    const { error: insertError } = await supabase.from('invoices').insert({
      user_id: params.userId,
      invoice_number: params.invoiceNumber,
      amount: params.amount,
      stripe_payment_id: params.stripePaymentId || null,
    })

    if (insertError) {
      console.error('[Invoice] Database insert error:', insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Invoice] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export { PRICE, PRODUCT_DESCRIPTION }
