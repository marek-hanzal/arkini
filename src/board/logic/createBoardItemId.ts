import { DateTime } from "luxon";

export function createBoardItemId() {
	return `board:${DateTime.now().toMillis().toString(36)}:${crypto.randomUUID()}`;
}
