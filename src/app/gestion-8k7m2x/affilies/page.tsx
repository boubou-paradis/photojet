'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ---------- Types ----------
interface Affiliate {
  id: string
  name: string
  email: string
  promo_code: string
  created_at: string
  is_active: boolean
}

interface Commission {
  affiliate_id: string
  name: string
  email: string
  promo_code: string
  active_referrals: number
  commission_due: number
}

interface Referral {
  customer_email: string
  customer_name: string
  status: string
  created: string
  subscription_id: string
}

interface Payment {
  id: string
  affiliate_id: string
  amount: number
  period: string
  paid_at: string
}

// ---------- Component ----------
export default function AffiliatesAdminPage() {
  const router = useRouter()
  const supabase = createClient()

  // Auth state
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [storedPin, setStoredPin] = useState('')
  const [authChecking, setAuthChecking] = useState(true)

  // Data state
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Detail view
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPromoCode, setNewPromoCode] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addSuccess, setAddSuccess] = useState('')

  // Pay state
  const [payLoading, setPayLoading] = useState<string | null>(null)

  // 1. Vérifier que l'utilisateur est connecté et dans la whitelist
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
          console.error('[Affiliates] Auth error:', authError.message)
          router.replace('/admin/dashboard')
          return
        }

        if (!user) {
          console.warn('[Affiliates] No user session found')
          router.replace('/admin/dashboard')
          return
        }

        const userEmail = (user.email || '').toLowerCase().trim()
        if (userEmail !== 'mg.events35@gmail.com') {
          console.warn('[Affiliates] Unauthorized email:', userEmail)
          router.replace('/admin/dashboard')
          return
        }

        setAuthChecking(false)
      } catch (err) {
        console.error('[Affiliates] Auth check failed:', err)
        router.replace('/admin/dashboard')
      }
    }
    checkAuth()
  }, [supabase, router])

  // Helper pour les appels API avec le PIN
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': storedPin,
        ...(options.headers || {}),
      },
    })
  }, [storedPin])

  // 2. Charger les commissions
  const loadCommissions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/affiliates/commissions')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur')
      }
      const data = await res.json()
      setCommissions(data.commissions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  // Charger quand le PIN est vérifié
  useEffect(() => {
    if (pinVerified) {
      loadCommissions()
    }
  }, [pinVerified, loadCommissions])

  // 3. Vérifier le PIN
  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPinError('')

    // Tester le PIN en appelant l'API
    const res = await fetch('/api/affiliates', {
      headers: {
        'x-admin-pin': pinInput,
      },
    })

    if (res.ok) {
      setStoredPin(pinInput)
      setPinVerified(true)
    } else {
      setPinError('Code PIN incorrect')
    }
  }

  // 4. Voir le détail d'un affilié
  async function viewAffiliate(affiliateId: string) {
    setDetailLoading(true)
    setSelectedAffiliate(null)
    setReferrals([])
    setPayments([])

    try {
      const [detailRes, paymentsRes] = await Promise.all([
        apiFetch(`/api/affiliates/${affiliateId}`),
        apiFetch(`/api/affiliates/payments?affiliate_id=${affiliateId}`),
      ])

      if (detailRes.ok) {
        const detailData = await detailRes.json()
        setSelectedAffiliate(detailData.affiliate)
        setReferrals(detailData.referrals)
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        setPayments(paymentsData.payments)
      }
    } catch {
      setError('Erreur lors du chargement du détail')
    } finally {
      setDetailLoading(false)
    }
  }

  // 5. Marquer comme payé
  async function markAsPaid(affiliateId: string, amount: number) {
    if (amount <= 0) return
    if (!confirm(`Confirmer le paiement de ${amount.toFixed(2)}€ ?`)) return

    setPayLoading(affiliateId)
    try {
      const res = await apiFetch('/api/affiliates/payments', {
        method: 'POST',
        body: JSON.stringify({ affiliate_id: affiliateId, amount }),
      })

      if (res.ok) {
        // Recharger les données
        await loadCommissions()
        if (selectedAffiliate?.id === affiliateId) {
          await viewAffiliate(affiliateId)
        }
      }
    } catch {
      setError('Erreur lors de l\'enregistrement du paiement')
    } finally {
      setPayLoading(null)
    }
  }

  // 6. Ajouter un affilié
  async function handleAddAffiliate(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddSuccess('')
    setError('')

    try {
      const res = await apiFetch('/api/affiliates', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          promo_code: newPromoCode,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur')
      }

      setAddSuccess(`Affilié "${newName}" ajouté avec succès`)
      setNewName('')
      setNewEmail('')
      setNewPromoCode('')
      setShowAddForm(false)
      await loadCommissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout')
    } finally {
      setAddLoading(false)
    }
  }

  // ---------- Render ----------

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Vérification...</div>
      </div>
    )
  }

  // Écran PIN
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <form onSubmit={handlePinSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
          <h1 className="text-white text-lg font-semibold mb-4">Accès restreint</h1>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Code PIN"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {pinError && <p className="text-red-400 text-sm mb-3">{pinError}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Valider
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Affilies</h1>
            <p className="text-gray-400 text-sm mt-1">Commission : 20% de 29,90EUR par abonnement actif</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadCommissions}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Actualiser'}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              + Ajouter un affilie
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
            <button onClick={() => setError('')} className="ml-3 underline">Fermer</button>
          </div>
        )}

        {addSuccess && (
          <div className="bg-green-900/30 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-6">
            {addSuccess}
            <button onClick={() => setAddSuccess('')} className="ml-3 underline">Fermer</button>
          </div>
        )}

        {/* Section 4 : Formulaire d'ajout */}
        {showAddForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Nouvel affilie</h2>
            <form onSubmit={handleAddAffiliate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="DJ Martin"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="martin@email.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Code Promo</label>
                <input
                  type="text"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="DJMARTIN20"
                />
              </div>
              <div className="md:col-span-3 flex gap-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {addLoading ? 'Ajout en cours...' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Section 1 : Liste des affiliés avec commissions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Affilies et commissions</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Chargement des donnees Stripe...</div>
          ) : commissions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Aucun affilie pour le moment</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Code Promo</th>
                    <th className="px-4 py-3 font-medium text-center">Filleuls actifs</th>
                    <th className="px-4 py-3 font-medium text-right">Commission due</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.affiliate_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{c.email}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-900/40 text-blue-300 px-2 py-1 rounded text-sm font-mono">
                          {c.promo_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${c.active_referrals > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          {c.active_referrals}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${c.commission_due > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          {c.commission_due.toFixed(2)}EUR
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => viewAffiliate(c.affiliate_id)}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm transition-colors"
                          >
                            Voir
                          </button>
                          {c.commission_due > 0 && (
                            <button
                              onClick={() => markAsPaid(c.affiliate_id, c.commission_due)}
                              disabled={payLoading === c.affiliate_id}
                              className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {payLoading === c.affiliate_id ? '...' : 'Payer'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2 : Détail d'un affilié */}
        {(selectedAffiliate || detailLoading) && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {detailLoading ? 'Chargement...' : `Detail : ${selectedAffiliate?.name}`}
              </h2>
              <button
                onClick={() => { setSelectedAffiliate(null); setReferrals([]); setPayments([]) }}
                className="text-gray-400 hover:text-white text-sm"
              >
                Fermer
              </button>
            </div>

            {!detailLoading && selectedAffiliate && (
              <div className="p-4">
                {/* Filleuls */}
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Filleuls ({referrals.length} total, {referrals.filter(r => r.status === 'active' || r.status === 'trialing').length} actifs)
                </h3>

                {referrals.length === 0 ? (
                  <p className="text-gray-500 text-sm mb-6">Aucun filleul pour le moment</p>
                ) : (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800">
                          <th className="px-3 py-2 font-medium">Nom</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Date inscription</th>
                          <th className="px-3 py-2 font-medium">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((r, i) => (
                          <tr key={i} className="border-b border-gray-800/50">
                            <td className="px-3 py-2">{r.customer_name}</td>
                            <td className="px-3 py-2 text-gray-400">{r.customer_email}</td>
                            <td className="px-3 py-2 text-gray-400">
                              {r.created !== 'N/A' ? new Date(r.created).toLocaleDateString('fr-FR') : 'N/A'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                r.status === 'active' || r.status === 'trialing'
                                  ? 'bg-green-900/40 text-green-400'
                                  : 'bg-red-900/40 text-red-400'
                              }`}>
                                {r.status === 'active' ? 'Actif' :
                                 r.status === 'trialing' ? 'Essai' :
                                 r.status === 'canceled' ? 'Annule' :
                                 r.status === 'past_due' ? 'Impaye' : r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Section 3 : Historique des paiements */}
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Historique des paiements</h3>

                {payments.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun paiement enregistre</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800">
                          <th className="px-3 py-2 font-medium">Periode</th>
                          <th className="px-3 py-2 font-medium">Montant</th>
                          <th className="px-3 py-2 font-medium">Date du paiement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-800/50">
                            <td className="px-3 py-2">{p.period}</td>
                            <td className="px-3 py-2 text-green-400 font-medium">{Number(p.amount).toFixed(2)}EUR</td>
                            <td className="px-3 py-2 text-gray-400">
                              {new Date(p.paid_at).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
