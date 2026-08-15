// docker-compose.yml's local-dev fallbacks (JWT_SECRET/MONGO_ROOT_PASSWORD defaulting to
// obviously-fake values if unset) exist so a fresh clone can `docker-compose up` and just work
// without any setup - that's a real, worthwhile convenience and this file doesn't remove it.
// What it closes is the silent failure mode: those same fallbacks apply identically in
// production if an operator forgets to set the real env vars, with no error, no warning, just a
// working system on known-public credentials. This runs once at startup and refuses to boot
// rather than run insecurely when it matters.
const KNOWN_INSECURE_JWT_SECRETS = ['your_jwt_secret_key_change_in_production', ''];

function assertProductionSecretsConfigured() {
  if (process.env.NODE_ENV !== 'production') return;

  const problems = [];

  if (!process.env.JWT_SECRET || KNOWN_INSECURE_JWT_SECRETS.includes(process.env.JWT_SECRET)) {
    problems.push('JWT_SECRET is unset or still the placeholder value from docker-compose.yml\'s local-dev fallback.');
  }

  const mongoUri = process.env.MONGO_URI || '';
  if (mongoUri.includes(':password@') || mongoUri.includes('admin:password')) {
    problems.push('MONGO_URI still contains the local-dev fallback credentials (admin/password).');
  }

  if (problems.length > 0) {
    console.error('Refusing to start in production with insecure configuration:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Set real values for these in the production environment and restart.');
    process.exit(1);
  }
}

module.exports = { assertProductionSecretsConfigured };
