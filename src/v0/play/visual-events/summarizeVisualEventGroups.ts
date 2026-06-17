import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

const readAnimation = (event: ActionVisualEventSchema.Type) => event.animation;

const readItemIds = (event: ActionVisualEventSchema.Type) => ({
	item: "itemInstanceId" in event ? event.itemInstanceId : undefined,
	source: "sourceItemInstanceId" in event ? event.sourceItemInstanceId : undefined,
	target: "targetItemInstanceId" in event ? event.targetItemInstanceId : undefined,
});

interface GroupAccumulator {
	animation: ActionVisualAnimationSchema.Type;
	eventTypes: string[];
	itemIds: ReturnType<typeof readItemIds>[];
	count: number;
}

export const summarizeVisualEventGroups = (events: readonly ActionVisualEventSchema.Type[]) => {
	const groups = new Map<string, GroupAccumulator>();

	for (const event of events) {
		const animation = readAnimation(event);
		if (!animation) continue;

		const existing = groups.get(animation.groupId);
		if (existing) {
			existing.count += 1;
			existing.eventTypes.push(event.type);
			existing.itemIds.push(readItemIds(event));
			continue;
		}

		groups.set(animation.groupId, {
			animation,
			count: 1,
			eventTypes: [
				event.type,
			],
			itemIds: [
				readItemIds(event),
			],
		});
	}

	return [
		...groups.values(),
	].map(({ animation, count, eventTypes, itemIds }) => ({
		groupId: animation.groupId,
		mode: animation.mode,
		effect: animation.effect,
		cause: animation.cause,
		delayMs: animation.delayMs,
		durationMs: animation.durationMs,
		sequenceIndex: animation.sequenceIndex,
		count,
		eventTypes,
		itemIds,
	}));
};
