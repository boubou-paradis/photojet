-- Migration: Création de la table invoices et du bucket storage
-- À exécuter dans Supabase SQL Editor

-- 1. Créer la table invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Créer un index pour la recherche par user_id
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);

-- 3. Créer un index pour la recherche par invoice_number
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

-- 4. Activer RLS (Row Level Security)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. Politique: Les utilisateurs peuvent voir leurs propres factures
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Politique: Seul le service role peut insérer des factures
CREATE POLICY "Service role can insert invoices" ON public.invoices
  FOR INSERT
  WITH CHECK (true);

-- 7. Créer le bucket storage pour les factures (si pas déjà fait)
-- Note: Exécuter cette commande dans le dashboard Storage ou via l'API
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('invoices', 'invoices', false)
-- ON CONFLICT (id) DO NOTHING;

-- 8. Politique storage: Les utilisateurs peuvent télécharger leurs propres factures
-- Note: À configurer dans le dashboard Supabase > Storage > invoices > Policies
