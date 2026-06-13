export function createBoardItemId() {
	return `board:${Date.now().toString(36)}:${crypto.randomUUID()}`;
}
