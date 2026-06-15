export async function loadV0PlayBackend() {
	const db = await import("~/play/logic/playBackend");
	await db.bootstrapDatabase();
	return db;
}
