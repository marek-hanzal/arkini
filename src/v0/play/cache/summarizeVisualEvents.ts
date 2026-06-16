import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export const summarizeVisualEvents = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.map((event) => {
		const item = "itemInstanceId" in event ? event.itemInstanceId : undefined;
		const source = "sourceItemInstanceId" in event ? event.sourceItemInstanceId : undefined;
		const target = "targetItemInstanceId" in event ? event.targetItemInstanceId : undefined;
		return {
			type: event.type,
			item,
			source,
			target,
			itemId: "itemId" in event ? event.itemId : undefined,
			from: "from" in event ? event.from : undefined,
			to: "to" in event ? event.to : undefined,
		};
	});
