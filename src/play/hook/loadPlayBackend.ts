export async function loadPlayBackend() {
  const db = await import("~/play/logic/playBackend");
  await db.bootstrapDatabase();
  return db;
}
