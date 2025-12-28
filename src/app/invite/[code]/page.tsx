'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ImagePlus, Send, X, Loader2, CheckCircle, Clock, MessageCircle, Rocket, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase'
import { compressImage } from '@/lib/image-utils'
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

        // Check if quiz lobby is visible - redirect to quiz join page
        if (data.quiz_lobby_visible) {
          router.push(`/join/${code}`)
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
  }, [code, router, supabase])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Seules les images sont acceptées')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('La taille maximale est de 50MB')
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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0F]">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" />
          <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-[#D4AF37]" />
        </div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0F] p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="absolute -inset-1 bg-red-500/10 rounded-3xl blur-xl" />
          <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-red-500/20 w-full max-w-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center border-2 border-red-500/20">
                <X className="h-10 w-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Oups !</h1>
              <p className="text-gray-400 mb-6">{error}</p>
              <Button
                onClick={() => router.push('/')}
                className="bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-[#0D0D0F] font-semibold"
              >
                Retour à l&apos;accueil
              </Button>
            </div>
            <div className="h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] p-4 overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      <div className="max-w-sm mx-auto pt-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-[#D4AF37]/20 blur-2xl rounded-full" />
            <Image
              src="/images/animajet_logo_principal.png"
              alt="AnimaJet"
              width={160}
              height={160}
              className="relative z-10 drop-shadow-2xl"
            />
          </div>
          <p className="text-gray-400 text-sm mt-2">{session?.name}</p>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-gradient-to-r from-[#D4AF37]/10 to-amber-600/10 border border-[#D4AF37]/30 rounded-full"
          >
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-sm font-mono text-[#D4AF37] font-bold">#{code}</span>
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          </motion.div>
        </motion.div>

        {/* Tab Toggle */}
        {messagesEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2 mb-4 p-1.5 bg-[#1A1A1E] rounded-2xl border border-white/5"
          >
            <button
              onClick={() => setActiveTab('photo')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'photo'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#0D0D0F] shadow-lg shadow-[#D4AF37]/20'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <Camera className="h-5 w-5" />
              Photo
            </button>
            <button
              onClick={() => setActiveTab('message')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'message'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#0D0D0F] shadow-lg shadow-[#D4AF37]/20'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageCircle className="h-5 w-5" />
              Message
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* PHOTO TAB */}
          {activeTab === 'photo' && (
            <motion.div
              key="photo-tab"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.3 }}
            >
              {photoUploadStatus !== 'idle' ? (
                <div className="relative">
                  <div className={`absolute -inset-1 rounded-3xl blur-xl ${photoUploadStatus === 'success' ? 'bg-emerald-500/20' : 'bg-[#D4AF37]/20'}`} />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden">
                    <div className={`h-1 bg-gradient-to-r from-transparent ${photoUploadStatus === 'success' ? 'via-emerald-500' : 'via-[#D4AF37]'} to-transparent`} />
                    <div className="p-8 text-center">
                      {photoUploadStatus === 'success' ? (
                        <>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/30"
                          >
                            <CheckCircle className="h-12 w-12 text-emerald-500" />
                          </motion.div>
                          <h2 className="text-2xl font-bold text-white mb-2">Photo envoyée !</h2>
                          <p className="text-gray-400 mb-6">Votre photo est en ligne !</p>
                        </>
                      ) : (
                        <>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center border-2 border-[#D4AF37]/30"
                          >
                            <Clock className="h-12 w-12 text-[#D4AF37]" />
                          </motion.div>
                          <h2 className="text-2xl font-bold text-white mb-2">Photo envoyée !</h2>
                          <p className="text-gray-400 mb-6">En attente de validation</p>
                        </>
                      )}
                      <Button
                        onClick={handleNewPhoto}
                        className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25"
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Envoyer une autre photo
                      </Button>
                    </div>
                  </div>
                </div>
              ) : preview ? (
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#D4AF37]/10 rounded-3xl blur-xl" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-[#D4AF37]/20 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
                    <div className="p-6">
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 border-2 border-[#D4AF37]/30 shadow-lg shadow-black/50">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={handleCancel}
                          className="absolute top-3 right-3 p-2.5 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all hover:scale-110"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <Input
                        placeholder="Votre prénom (optionnel)"
                        value={uploaderName}
                        onChange={(e) => setUploaderName(e.target.value)}
                        className="mb-4 h-12 bg-[#0D0D0F] border-white/10 focus:border-[#D4AF37] text-white placeholder:text-gray-600 rounded-xl"
                      />

                      {error && <p className="text-sm text-red-500 mb-4 text-center">{error}</p>}

                      <Button
                        onClick={handlePhotoUpload}
                        disabled={uploading}
                        className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25 disabled:opacity-50"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {compressing ? `Optimisation... ${compressionProgress}%` : 'Envoi en cours...'}
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
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -inset-1 bg-[#D4AF37]/10 rounded-3xl blur-xl opacity-50" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
                    <div className="p-6 space-y-4">
                      <p className="text-center text-gray-400 mb-6">
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
                        className="w-full h-16 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all"
                      >
                        <Camera className="mr-3 h-6 w-6" />
                        Prendre une photo
                      </Button>

                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="w-full h-16 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 rounded-xl text-lg font-semibold"
                      >
                        <ImagePlus className="mr-3 h-6 w-6" />
                        Choisir dans ma galerie
                      </Button>

                      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* MESSAGE TAB */}
          {activeTab === 'message' && (
            <motion.div
              key="message-tab"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {messageUploadStatus !== 'idle' ? (
                <div className="relative">
                  <div className={`absolute -inset-1 rounded-3xl blur-xl ${messageUploadStatus === 'success' ? 'bg-emerald-500/20' : 'bg-violet-500/20'}`} />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden">
                    <div className={`h-1 bg-gradient-to-r from-transparent ${messageUploadStatus === 'success' ? 'via-emerald-500' : 'via-violet-500'} to-transparent`} />
                    <div className="p-8 text-center">
                      {messageUploadStatus === 'success' ? (
                        <>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/30"
                          >
                            <CheckCircle className="h-12 w-12 text-emerald-500" />
                          </motion.div>
                          <h2 className="text-2xl font-bold text-white mb-2">Message envoyé !</h2>
                          <p className="text-gray-400 mb-6">Il sera affiché sur le diaporama</p>
                        </>
                      ) : (
                        <>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center border-2 border-violet-500/30"
                          >
                            <Clock className="h-12 w-12 text-violet-500" />
                          </motion.div>
                          <h2 className="text-2xl font-bold text-white mb-2">Message envoyé !</h2>
                          <p className="text-gray-400 mb-6">En attente de validation</p>
                        </>
                      )}
                      <Button
                        onClick={handleNewMessage}
                        className="w-full h-14 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-violet-500/25"
                      >
                        <MessageCircle className="h-5 w-5 mr-2" />
                        Envoyer un autre message
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -inset-1 bg-violet-500/10 rounded-3xl blur-xl opacity-50" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
                    <div className="p-6 space-y-4">
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 mb-4">
                          <MessageCircle className="h-8 w-8 text-violet-400" />
                        </div>
                        <p className="text-gray-400 text-sm">
                          Laissez un message de félicitations !
                        </p>
                      </div>

                      <div className="relative">
                        <Textarea
                          placeholder="Écrivez votre message de félicitations..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                          className="min-h-[140px] bg-[#0D0D0F] border-white/10 focus:border-violet-500 text-white placeholder:text-gray-600 resize-none rounded-xl"
                        />
                        <div className={`absolute bottom-3 right-3 text-xs ${
                          message.length >= MAX_MESSAGE_LENGTH ? 'text-red-500' : 'text-gray-600'
                        }`}>
                          {message.length}/{MAX_MESSAGE_LENGTH}
                        </div>
                      </div>

                      <Input
                        placeholder="Votre prénom (optionnel)"
                        value={messageAuthor}
                        onChange={(e) => setMessageAuthor(e.target.value)}
                        className="h-12 bg-[#0D0D0F] border-white/10 focus:border-violet-500 text-white placeholder:text-gray-600 rounded-xl"
                      />

                      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                      <Button
                        onClick={handleMessageSend}
                        disabled={sendingMessage || !message.trim()}
                        className="w-full h-14 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-50"
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
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
