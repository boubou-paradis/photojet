'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ImagePlus, Send, X, Loader2, CheckCircle, Clock, MessageCircle, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase'
import { compressImage, formatFileSize, needsCompression, CompressionProgress } from '@/lib/image-utils'
import { Session } from '@/types/database'

type TabType = 'photo' | 'message'
type UploadStatus = 'idle' | 'success' | 'pending'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('photo')

  // Photo states
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [photoUploadStatus, setPhotoUploadStatus] = useState<UploadStatus>('idle')
  const [uploaderName, setUploaderName] = useState('')

  // Message states
  const [message, setMessage] = useState('')
  const [messageAuthor, setMessageAuthor] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageUploadStatus, setMessageUploadStatus] = useState<UploadStatus>('idle')

  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const MAX_MESSAGE_LENGTH = 280

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
    setPhotoUploadStatus('idle')
  }

  const handlePhotoUpload = async () => {
    if (!selectedFile || !session) return

    setUploading(true)
    setCompressing(true)
    setCompressionProgress(0)
    setError(null)

    try {
      const { data: freshSession } = await supabase
        .from('sessions')
        .select('moderation_enabled')
        .eq('id', session.id)
        .single()

      const moderationEnabled = freshSession?.moderation_enabled ?? false
      const isApproved = !moderationEnabled

      // Compress image with progress callback
      const compressedFile = await compressImage(selectedFile, (progress) => {
        if (progress.progress !== undefined) {
          setCompressionProgress(Math.round(progress.progress * 100))
        }
        if (progress.stage === 'done') {
          setCompressing(false)
        }
      })
      setCompressing(false)

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
          status: isApproved ? 'approved' : 'pending',
          uploader_name: uploaderName || null,
          approved_at: isApproved ? new Date().toISOString() : null,
          source: 'invite',
        })

      if (dbError) throw dbError

      setPhotoUploadStatus(isApproved ? 'success' : 'pending')
      setSelectedFile(null)

      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setUploading(false)
    }
  }

  const handleMessageSend = async () => {
    if (!message.trim() || !session) return

    setSendingMessage(true)
    setError(null)

    try {
      const { data: freshSession } = await supabase
        .from('sessions')
        .select('moderation_enabled')
        .eq('id', session.id)
        .single()

      const moderationEnabled = freshSession?.moderation_enabled ?? false
      const isApproved = !moderationEnabled

      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          session_id: session.id,
          content: message.trim(),
          author_name: messageAuthor || null,
          status: isApproved ? 'approved' : 'pending',
          approved_at: isApproved ? new Date().toISOString() : null,
          source: 'invite',
        })

      if (dbError) throw dbError

      setMessageUploadStatus(isApproved ? 'success' : 'pending')
      setMessage('')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreview(null)
    setPhotoUploadStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleNewPhoto = () => {
    setPhotoUploadStatus('idle')
    setPreview(null)
    setUploaderName('')
  }

  const handleNewMessage = () => {
    setMessageUploadStatus('idle')
    setMessageAuthor('')
  }

  const messagesEnabled = session?.messages_enabled ?? true

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

      <div className="max-w-sm mx-auto pt-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <Image
            src="/logo.png"
            alt="AnimaJet"
            width={70}
            height={70}
            className="mx-auto mb-3 drop-shadow-lg"
          />
          <p className="text-[#B0B0B5] text-sm">{session?.name}</p>
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full">
            <span className="text-xs font-mono text-[#D4AF37] font-semibold">#{code}</span>
          </div>
        </motion.div>

        {/* Tab Toggle */}
        {messagesEnabled && (
          <div className="flex gap-2 mb-4 p-1 bg-[#242428] rounded-xl border border-[rgba(255,255,255,0.1)]">
            <button
              onClick={() => setActiveTab('photo')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'photo'
                  ? 'bg-[#D4AF37] text-[#1A1A1E]'
                  : 'text-[#B0B0B5] hover:text-white'
              }`}
            >
              <Camera className="h-5 w-5" />
              Photo
            </button>
            <button
              onClick={() => setActiveTab('message')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'message'
                  ? 'bg-[#D4AF37] text-[#1A1A1E]'
                  : 'text-[#B0B0B5] hover:text-white'
              }`}
            >
              <MessageCircle className="h-5 w-5" />
              Message
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* PHOTO TAB */}
          {activeTab === 'photo' && (
            <motion.div
              key="photo-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {photoUploadStatus !== 'idle' ? (
                <div className="card-gold rounded-xl">
                  <div className="p-8 text-center">
                    {photoUploadStatus === 'success' ? (
                      <>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                          <CheckCircle className="h-10 w-10 text-[#4CAF50]" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Photo envoyée !</h2>
                        <p className="text-[#B0B0B5] mb-6">Votre photo est en ligne !</p>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
                          <Clock className="h-10 w-10 text-[#D4AF37]" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Photo envoyée !</h2>
                        <p className="text-[#B0B0B5] mb-6">Votre photo est en attente de validation</p>
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
              ) : preview ? (
                <div className="card-gold rounded-xl">
                  <div className="p-6">
                    <div className="relative aspect-square rounded-lg overflow-hidden mb-4 border-2 border-[#D4AF37]/30">
                      <img src={preview} alt="Preview" className="w-full h-full object-cover" />
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

                    {error && <p className="text-sm text-[#E53935] mb-4">{error}</p>}

                    <Button
                      onClick={handlePhotoUpload}
                      disabled={uploading}
                      className="w-full h-12 bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90 disabled:opacity-50"
                      size="lg"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {compressing ? (
                            `Optimisation... ${compressionProgress}%`
                          ) : (
                            'Envoi en cours...'
                          )}
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
              ) : (
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

                    {error && <p className="text-sm text-[#E53935] text-center">{error}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* MESSAGE TAB */}
          {activeTab === 'message' && (
            <motion.div
              key="message-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {messageUploadStatus !== 'idle' ? (
                <div className="card-gold rounded-xl">
                  <div className="p-8 text-center">
                    {messageUploadStatus === 'success' ? (
                      <>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                          <CheckCircle className="h-10 w-10 text-[#4CAF50]" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Message envoyé !</h2>
                        <p className="text-[#B0B0B5] mb-6">Votre message sera affiché sur le diaporama</p>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
                          <Clock className="h-10 w-10 text-[#D4AF37]" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Message envoyé !</h2>
                        <p className="text-[#B0B0B5] mb-6">Votre message est en attente de validation</p>
                      </>
                    )}
                    <Button
                      onClick={handleNewMessage}
                      className="w-full bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
                    >
                      Envoyer un autre message
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="card-gold rounded-xl">
                  <div className="p-6 space-y-4">
                    <div className="text-center mb-2">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#D4AF37]/10 mb-3">
                        <MessageCircle className="h-6 w-6 text-[#D4AF37]" />
                      </div>
                      <p className="text-[#B0B0B5] text-sm">
                        Laissez un message de félicitations !
                      </p>
                    </div>

                    <div className="relative">
                      <Textarea
                        placeholder="Écrivez votre message de félicitations..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                        className="min-h-[120px] bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-[#6B6B70] resize-none"
                      />
                      <div className={`absolute bottom-2 right-3 text-xs ${
                        message.length >= MAX_MESSAGE_LENGTH ? 'text-[#E53935]' : 'text-[#6B6B70]'
                      }`}>
                        {message.length}/{MAX_MESSAGE_LENGTH}
                      </div>
                    </div>

                    <Input
                      placeholder="Votre prénom (optionnel)"
                      value={messageAuthor}
                      onChange={(e) => setMessageAuthor(e.target.value)}
                      className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-[#6B6B70]"
                    />

                    {error && <p className="text-sm text-[#E53935] text-center">{error}</p>}

                    <Button
                      onClick={handleMessageSend}
                      disabled={sendingMessage || !message.trim()}
                      className="w-full h-12 bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90 disabled:opacity-50"
                      size="lg"
                    >
                      {sendingMessage ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-5 w-5" />
                          Envoyer le message
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
