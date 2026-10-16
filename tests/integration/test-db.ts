/** Guard: integration tests wipe their database, so it must be clearly a test database. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. Integration tests need a separate PostgreSQL database (see README).");
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(name)) throw new Error(`Refusing to run integration tests against "${name}": the database name must contain "test".`);
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL_ORIGINAL) {
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
  }
  return url;
}
