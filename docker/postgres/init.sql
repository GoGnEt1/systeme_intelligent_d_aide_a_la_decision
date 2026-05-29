-- =============================================================
--  PostgreSQL — Script d'initialisation SmartShop
--  Exécuté automatiquement au 1er démarrage du container
-- =============================================================

-- Extension UUID (utile pour des identifiants plus robustes)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour les recherches full-text en français
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'SmartShop DB initialisée avec succès !';
END $$;
