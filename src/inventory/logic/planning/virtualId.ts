import { DateTime } from "luxon";

export function createVirtualId(prefix: string) {
	return `${prefix}:${DateTime.now().toMillis().toString(36)}:${crypto.randomUUID()}`;
}
