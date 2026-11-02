-- © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
--
-- Retire le trigger qui passait is_active à faux à toute modification d'une session
-- dont expires_at est dépassée. L'accès dépend de l'abonnement, jamais d'une durée :
-- ce trigger coupait des sessions d'abonnés actifs.
--
-- À appliquer APRÈS la mise en production du contrôle d'accès de /api/sessions/activate.
-- Ne modifie aucune ligne. La fonction check_session_expiry reste en place.

drop trigger if exists check_session_expiry_trigger on public.sessions;

-- Rollback :
-- create trigger check_session_expiry_trigger before update on public.sessions for each row execute function check_session_expiry();
