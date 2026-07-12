// Charge les variables d'environnement (.env) pour les tests d'intégration,
// qui nécessitent TEST_DATABASE_URL. Vitest ne lit pas .env par défaut.
import "dotenv/config";
