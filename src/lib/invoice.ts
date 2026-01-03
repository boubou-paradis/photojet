// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

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

  // Fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Colors
  const gold = rgb(212 / 255, 175 / 255, 55 / 255)
  const black = rgb(0.1, 0.1, 0.1)
  const darkGray = rgb(0.2, 0.2, 0.2)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.96, 0.96, 0.96) // #F5F5F5
  const white = rgb(1, 1, 1)

  // Margins
  const margin = 40
  const contentWidth = width - margin * 2

  let y = height - margin

  // =====================
  // 1. HEADER
  // =====================

  // Logo AnimaJet (text version since we can't embed external images easily)
  page.drawText('AnimaJet', {
    x: margin,
    y: y - 5,
    size: 32,
    font: fontBold,
    color: gold,
  })

  // Subtitle under logo
  page.drawText('Animation d\'evenements', {
    x: margin,
    y: y - 25,
    size: 10,
    font: fontRegular,
    color: gray,
  })

  // "FACTURE" title - right aligned
  const factureText = 'FACTURE'
  const factureWidth = fontBold.widthOfTextAtSize(factureText, 28)
  page.drawText(factureText, {
    x: width - margin - factureWidth,
    y: y - 5,
    size: 28,
    font: fontBold,
    color: gold,
  })

  y -= 50

  // Golden separator line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 2,
    color: gold,
  })

  y -= 30

  // =====================
  // 2. INVOICE INFO BOX (right aligned)
  // =====================

  const infoBoxWidth = 180
  const infoBoxHeight = 50
  const infoBoxX = width - margin - infoBoxWidth

  // Info box background
  page.drawRectangle({
    x: infoBoxX,
    y: y - infoBoxHeight + 15,
    width: infoBoxWidth,
    height: infoBoxHeight,
    color: lightGray,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  })

  // Invoice number
  page.drawText('Facture N°', {
    x: infoBoxX + 10,
    y: y,
    size: 9,
    font: fontRegular,
    color: gray,
  })
  page.drawText(data.invoiceNumber, {
    x: infoBoxX + 10,
    y: y - 14,
    size: 12,
    font: fontBold,
    color: black,
  })

  // Date
  page.drawText('Date :', {
    x: infoBoxX + 100,
    y: y,
    size: 9,
    font: fontRegular,
    color: gray,
  })
  page.drawText(formatDate(data.date), {
    x: infoBoxX + 100,
    y: y - 14,
    size: 11,
    font: fontRegular,
    color: black,
  })

  y -= 70

  // =====================
  // 3. EMITTER / CLIENT BLOCKS
  // =====================

  const blockWidth = (contentWidth - 30) / 2
  const blockHeight = 130
  const blockPadding = 15

  // EMITTER block
  const emitterX = margin
  page.drawRectangle({
    x: emitterX,
    y: y - blockHeight,
    width: blockWidth,
    height: blockHeight,
    color: lightGray,
  })

  // EMITTER title
  page.drawText('EMETTEUR', {
    x: emitterX + blockPadding,
    y: y - 20,
    size: 9,
    font: fontBold,
    color: gold,
  })

  // Emitter details
  const emitterLines = [
    { text: COMPANY_INFO.name, bold: true },
    { text: COMPANY_INFO.owner, bold: false },
    { text: COMPANY_INFO.address, bold: false },
    { text: COMPANY_INFO.city, bold: false },
    { text: '', bold: false },
    { text: `SIRET : ${COMPANY_INFO.siret}`, bold: false },
    { text: COMPANY_INFO.email, bold: false },
    { text: COMPANY_INFO.phone, bold: false },
  ]

  let emitterY = y - 38
  for (const line of emitterLines) {
    if (line.text) {
      page.drawText(line.text, {
        x: emitterX + blockPadding,
        y: emitterY,
        size: 9,
        font: line.bold ? fontBold : fontRegular,
        color: black,
      })
    }
    emitterY -= 12
  }

  // CLIENT block
  const clientX = margin + blockWidth + 30
  page.drawRectangle({
    x: clientX,
    y: y - blockHeight,
    width: blockWidth,
    height: blockHeight,
    color: lightGray,
  })

  // CLIENT title
  page.drawText('CLIENT', {
    x: clientX + blockPadding,
    y: y - 20,
    size: 9,
    font: fontBold,
    color: gold,
  })

  // Client details
  page.drawText(data.customerName || 'Client', {
    x: clientX + blockPadding,
    y: y - 38,
    size: 10,
    font: fontBold,
    color: black,
  })

  page.drawText(data.customerEmail, {
    x: clientX + blockPadding,
    y: y - 52,
    size: 9,
    font: fontRegular,
    color: black,
  })

  y -= blockHeight + 30

  // =====================
  // 4. DETAIL TABLE
  // =====================

  const tableLeft = margin
  const tableRight = width - margin
  const tableWidth = tableRight - tableLeft
  const colPriceWidth = 80
  const colDescWidth = tableWidth - colPriceWidth
  const rowHeight = 35

  // Table header
  page.drawRectangle({
    x: tableLeft,
    y: y - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: gold,
  })

  page.drawText('Description', {
    x: tableLeft + 15,
    y: y - 22,
    size: 11,
    font: fontBold,
    color: white,
  })

  page.drawText('Prix', {
    x: tableLeft + colDescWidth + 15,
    y: y - 22,
    size: 11,
    font: fontBold,
    color: white,
  })

  y -= rowHeight

  // Product row (white background)
  page.drawRectangle({
    x: tableLeft,
    y: y - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: white,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 0.5,
  })

  page.drawText(PRODUCT_DESCRIPTION, {
    x: tableLeft + 15,
    y: y - 22,
    size: 10,
    font: fontRegular,
    color: black,
  })

  page.drawText(formatPrice(data.amount), {
    x: tableLeft + colDescWidth + 15,
    y: y - 22,
    size: 10,
    font: fontRegular,
    color: black,
  })

  y -= rowHeight

  // Total row (dark background)
  const totalRowHeight = 40
  page.drawRectangle({
    x: tableLeft,
    y: y - totalRowHeight,
    width: tableWidth,
    height: totalRowHeight,
    color: darkGray,
  })

  page.drawText('TOTAL', {
    x: tableLeft + 15,
    y: y - 26,
    size: 13,
    font: fontBold,
    color: white,
  })

  page.drawText(formatPrice(data.amount), {
    x: tableLeft + colDescWidth + 15,
    y: y - 26,
    size: 13,
    font: fontBold,
    color: white,
  })

  y -= totalRowHeight + 30

  // =====================
  // 5. FOOTER
  // =====================

  // TVA notice (italic, gray)
  page.drawText('TVA non applicable, article 293 B du CGI', {
    x: margin,
    y,
    size: 9,
    font: fontOblique,
    color: gray,
  })

  y -= 40

  // Thank you message (centered, gold)
  const thankYouText = 'Merci pour votre confiance !'
  const thankYouWidth = fontBold.widthOfTextAtSize(thankYouText, 14)
  page.drawText(thankYouText, {
    x: (width - thankYouWidth) / 2,
    y,
    size: 14,
    font: fontBold,
    color: gold,
  })

  y -= 25

  // Golden line
  page.drawLine({
    start: { x: margin + 100, y },
    end: { x: width - margin - 100, y },
    thickness: 1,
    color: gold,
  })

  // Bottom copyright
  const currentYear = new Date().getFullYear()
  const copyrightText = `© ${currentYear} AnimaJet - MG Events Animation`
  const copyrightWidth = fontRegular.widthOfTextAtSize(copyrightText, 8)
  page.drawText(copyrightText, {
    x: (width - copyrightWidth) / 2,
    y: 30,
    size: 8,
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
