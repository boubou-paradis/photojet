'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Photo, PhotoStatus } from '@/types/database'

interface UsePhotosOptions {
  sessionId: string
  status?: PhotoStatus | PhotoStatus[]
  realtime?: boolean
}

export function usePhotos({ sessionId, status, realtime = true }: UsePhotosOptions) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchPhotos = useCallback(async () => {
    try {
      let query = supabase
        .from('photos')
        .select('*')
        .eq('session_id', sessionId)
        .order('uploaded_at', { ascending: false })

      if (status) {
        if (Array.isArray(status)) {
          query = query.in('status', status)
        } else {
          query = query.eq('status', status)
        }
      }

      const { data, error } = await query

      if (error) throw error
      setPhotos(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos')
    } finally {
      setLoading(false)
    }
  }, [sessionId, status, supabase])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  useEffect(() => {
    if (!realtime) return

    const channel = supabase
      .channel(`photos:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPhoto = payload.new as Photo
            if (!status || (Array.isArray(status) ? status.includes(newPhoto.status) : status === newPhoto.status)) {
              setPhotos((prev) => [newPhoto, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPhoto = payload.new as Photo
            setPhotos((prev) => {
              const exists = prev.find((p) => p.id === updatedPhoto.id)
              if (exists) {
                if (!status || (Array.isArray(status) ? status.includes(updatedPhoto.status) : status === updatedPhoto.status)) {
                  return prev.map((p) => (p.id === updatedPhoto.id ? updatedPhoto : p))
                } else {
                  return prev.filter((p) => p.id !== updatedPhoto.id)
                }
              } else if (!status || (Array.isArray(status) ? status.includes(updatedPhoto.status) : status === updatedPhoto.status)) {
                return [updatedPhoto, ...prev]
              }
              return prev
            })
          } else if (payload.eventType === 'DELETE') {
            const deletedPhoto = payload.old as Photo
            setPhotos((prev) => prev.filter((p) => p.id !== deletedPhoto.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, status, realtime, supabase])

  return { photos, loading, error, refetch: fetchPhotos }
}
