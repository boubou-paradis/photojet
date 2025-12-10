'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ImagePlus, Send, X, Loader2, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { compressImage } from '@/lib/image-utils'
import { Session } from '@/types/database'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'pending'>('idle')
  const [uploaderName, setUploaderName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchSession() {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single()

        if (error) throw error

        const now = new Date()
        const expiresAt = new Date(data.expires_at)
        if (expiresAt < now) {
          setError('Cette session a expiré')
          setLoading(false)
          return
        }

        setSession(data)
      } catch {
        setError('Session introuvable')
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchSession()
    }
  }, [code, supabase])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Seules les images sont acceptées')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('La taille maximale est de 10MB')
      return
    }

    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
    setUploadStatus('idle')
  }

  const handleUpload = async () => {
    if (!selectedFile || !session) return

    setUploading(true)
    setError(null)

    try {
      const compressedFile = await compressImage(selectedFile)

      const fileName = `${session.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
        })

      if (uploadError) throw uploadError

      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          session_id: session.id,
          storage_path: fileName,
          status: session.moderation_enabled ? 'pending' : 'approved',
          uploader_name: uploaderName || null,
          approved_at: session.moderation_enabled ? null : new Date().toISOString(),
        })

      if (dbError) throw dbError

      setUploadStatus(session.moderation_enabled ? 'pending' : 'success')
      setSelectedFile(null)

      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreview(null)
    setUploadStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleNewPhoto = () => {
    setUploadStatus('idle')
    setPreview(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1E]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1E] p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="card-gold rounded-xl w-full max-w-sm relative z-10">
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E53935]/10 flex items-center justify-center">
              <X className="h-8 w-8 text-[#E53935]" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Oups !</h1>
            <p className="text-[#B0B0B5] mb-6">{error}</p>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
            >
              Retour à l&apos;accueil
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E] p-4 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#D4AF37]/10 blur-[100px] rounded-full" />

      <div className="max-w-sm mx-auto pt-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Image
            src="/logo.png"
            alt="PhotoJet"
            width={80}
            height={80}
            className="mx-auto mb-4 drop-shadow-lg"
          />
          <p className="text-[#B0B0B5]">{session?.name}</p>
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full">
            <span className="text-sm font-mono text-[#D4AF37] font-semibold">#{code}</span>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {uploadStatus !== 'idle' ? (
            <motion.div
              key="status"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="card-gold rounded-xl">
                <div className="p-8 text-center">
                  {uploadStatus === 'success' ? (
                    <>
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                        <CheckCircle className="h-10 w-10 text-[#4CAF50]" />
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2">Photo envoyée !</h2>
                      <p className="text-[#B0B0B5] mb-6">
                        Votre photo est en ligne !
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
                        <Clock className="h-10 w-10 text-[#D4AF37]" />
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2">Photo envoyée !</h2>
                      <p className="text-[#B0B0B5] mb-6">
                        Votre photo est en attente de validation
                      </p>
                    </>
                  )}
                  <Button
                    onClick={handleNewPhoto}
                    className="w-full bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
                  >
                    Envoyer une autre photo
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : preview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="card-gold rounded-xl">
                <div className="p-6">
                  <div className="relative aspect-square rounded-lg overflow-hidden mb-4 border-2 border-[#D4AF37]/30">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={handleCancel}
                      className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <Input
                    placeholder="Votre prénom (optionnel)"
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    className="mb-4 bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-[#6B6B70]"
                  />

                  {error && (
                    <p className="text-sm text-[#E53935] mb-4">{error}</p>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full h-12 bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90 disabled:opacity-50"
                    size="lg"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        Envoyer la photo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="card-gold rounded-xl">
                <div className="p-6 space-y-4">
                  <p className="text-center text-[#B0B0B5] mb-4">
                    Partagez vos photos de l&apos;événement !
                  </p>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <Button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full h-14 bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
                    size="lg"
                  >
                    <Camera className="mr-2 h-6 w-6" />
                    Prendre une photo
                  </Button>

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full h-14 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
                    size="lg"
                  >
                    <ImagePlus className="mr-2 h-6 w-6" />
                    Choisir dans ma galerie
                  </Button>

                  {error && (
                    <p className="text-sm text-[#E53935] text-center">{error}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
