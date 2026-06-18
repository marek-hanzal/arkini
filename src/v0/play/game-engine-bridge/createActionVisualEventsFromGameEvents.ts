import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";

export namespace createActionVisualEventsFromGameEvents {
	export interface Props {
		events: readonly GameEvent[];
	}
}

const createdCause = (
	reason: Extract<
		GameEvent,
		{
			type: "item.created";
		}
	>["reason"],
): ActionVisualAnimationSchema.Type["cause"] => {
	if (reason === "product-output" || reason === "producer-input-withdraw") return "producer";
	if (reason === "stash-output") return "stash";
	if (reason === "craft-output" || reason === "craft-requirement-return") {
		return "craft";
	}
	return "inventory";
};

const createdGroupId = (
	event: Extract<
		GameEvent,
		{
			type: "item.created";
		}
	>,
) => `engine:${event.reason}:${event.originItemInstanceId ?? event.itemId}`;

const consumedGroupId = (
	event: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>,
) => `engine:${event.reason}:${event.itemId}`;

const createdEvent = (
	event: Extract<
		GameEvent,
		{
			type: "item.created";
		}
	>,
	sequenceIndex: number,
): ActionVisualEventSchema.Type => {
	if (event.to.kind === "inventory") {
		return {
			animation: ActionVisualAnimation.state({
				cause: createdCause(event.reason),
				groupId: createdGroupId(event),
			}),
			itemId: event.itemId,
			nextQuantity: event.to.nextQuantity,
			previousQuantity: event.to.previousQuantity,
			quantity: event.to.quantity,
			reason: event.reason,
			slotIndex: event.to.slotIndex,
			type: "inventory.quantity_changed",
		} as ActionVisualEventSchema.Type;
	}

	return {
		animation: ActionVisualAnimation.sequenceFadeIn({
			cause: createdCause(event.reason),
			groupId: createdGroupId(event),
			sequenceIndex,
		}),
		itemId: event.itemId,
		itemInstanceId: event.to.itemInstanceId,
		originItemInstanceId: event.originItemInstanceId,
		reason: event.reason,
		to: {
			kind: "board",
			x: event.to.x,
			y: event.to.y,
		},
		type: "item.spawned",
	} as ActionVisualEventSchema.Type;
};

const consumedEvent = (
	event: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>,
): ActionVisualEventSchema.Type => {
	if (event.from.kind === "inventory") {
		return {
			animation: ActionVisualAnimation.state({
				cause: "inventory",
				groupId: consumedGroupId(event),
			}),
			itemId: event.itemId,
			nextQuantity: event.from.nextQuantity,
			previousQuantity: event.from.previousQuantity,
			quantity: event.from.quantity,
			reason: event.reason,
			slotIndex: event.from.slotIndex,
			type: "inventory.quantity_changed",
		} as ActionVisualEventSchema.Type;
	}

	return {
		animation: ActionVisualAnimation.state({
			cause: "activation",
			groupId: consumedGroupId(event),
		}),
		itemId: event.itemId,
		itemInstanceId: event.from.itemInstanceId,
		reason: event.reason,
		type: "item.consumed",
	} as ActionVisualEventSchema.Type;
};

const mergeSourceItemInstanceId = (
	event: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>,
) => {
	if (event.from.kind === "board") return event.from.itemInstanceId;

	return `inventory:${event.from.slotIndex}:${event.itemId}`;
};

const mergeEvent = ({
	replaced,
	source,
}: {
	replaced: Extract<
		GameEvent,
		{
			type: "item.replaced";
		}
	>;
	source: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
}): ActionVisualEventSchema.Type =>
	({
		animation: ActionVisualAnimation.merge({
			cause: "merge",
			groupId: `engine:merge:${mergeSourceItemInstanceId(source)}:${replaced.itemInstanceId}`,
		}),
		consumeSource: true,
		resultItemId: replaced.toItemId,
		sourceItemId: source.itemId,
		sourceItemInstanceId: mergeSourceItemInstanceId(source),
		targetItemId: replaced.fromItemId,
		targetItemInstanceId: replaced.itemInstanceId,
		type: "item.merged",
	}) as ActionVisualEventSchema.Type;

const replacedEvent = (
	event: Extract<
		GameEvent,
		{
			type: "item.replaced";
		}
	>,
): ActionVisualEventSchema.Type =>
	({
		animation: ActionVisualAnimation.state({
			cause: event.reason === "stash-depleted" ? "stash" : "merge",
			groupId: `engine:${event.reason}:${event.itemInstanceId}`,
		}),
		fromItemId: event.fromItemId,
		itemInstanceId: event.itemInstanceId,
		reason: event.reason,
		toItemId: event.toItemId,
		type: "item.replaced",
	}) as ActionVisualEventSchema.Type;

const removedEvent = (
	event: Extract<
		GameEvent,
		{
			type: "item.removed";
		}
	>,
): ActionVisualEventSchema.Type => {
	if (event.reason === "stash-depleted") {
		return {
			animation: ActionVisualAnimation.state({
				cause: "stash",
				groupId: `engine:${event.reason}:${event.itemInstanceId}`,
			}),
			depletion: {
				kind: "remove",
			},
			itemInstanceId: event.itemInstanceId,
			type: "activation.depleted",
		} as ActionVisualEventSchema.Type;
	}

	return {
		animation: ActionVisualAnimation.state({
			cause: "activation",
			groupId: `engine:${event.reason}:${event.itemInstanceId}`,
		}),
		itemId: event.itemId,
		itemInstanceId: event.itemInstanceId,
		reason: event.reason,
		type: "item.consumed",
	} as ActionVisualEventSchema.Type;
};

const stashOpenedEvent = (
	event: Extract<
		GameEvent,
		{
			type: "stash.opened";
		}
	>,
): ActionVisualEventSchema.Type =>
	({
		animation: ActionVisualAnimation.state({
			cause: "stash",
			groupId: `engine:stash-opened:${event.stashItemInstanceId}`,
		}),
		itemInstanceId: event.stashItemInstanceId,
		mode: event.remainingCharges === 0 ? "exhaust" : "single",
		type: "activation.activated",
	}) as ActionVisualEventSchema.Type;

const upgradeStartedEvent = (
	event: Extract<
		GameEvent,
		{
			type: "upgrade.started";
		}
	>,
): ActionVisualEventSchema.Type =>
	({
		animation: ActionVisualAnimation.state({
			cause: "upgrade",
			groupId: `engine:upgrade-start:${event.jobId}:${event.upgradeId}`,
		}),
		targetLevel: event.tierIndex + 1,
		type: "upgrade.started",
		upgradeId: event.upgradeId,
	}) as ActionVisualEventSchema.Type;

export const createActionVisualEventsFromGameEvents = ({
	events,
}: createActionVisualEventsFromGameEvents.Props): ActionVisualEventSchema.Type[] => {
	const visualEvents: ActionVisualEventSchema.Type[] = [];
	const skipped = new Set<number>();
	let createdSequenceIndex = 0;

	for (const [index, event] of events.entries()) {
		if (skipped.has(index)) continue;

		if (event.type === "item.created") {
			visualEvents.push(createdEvent(event, createdSequenceIndex));
			createdSequenceIndex += 1;
			continue;
		}

		if (event.type === "item.consumed") {
			if (event.reason === "merge-source") {
				const replacementIndex = events.findIndex(
					(candidate, candidateIndex) =>
						candidateIndex > index &&
						!skipped.has(candidateIndex) &&
						candidate.type === "item.replaced" &&
						candidate.reason === "merge-result",
				);
				const replacement = events[replacementIndex];
				if (replacement?.type === "item.replaced") {
					skipped.add(replacementIndex);
					visualEvents.push(
						mergeEvent({
							replaced: replacement,
							source: event,
						}),
					);
					continue;
				}
			}

			visualEvents.push(consumedEvent(event));
			continue;
		}

		if (event.type === "item.replaced") {
			visualEvents.push(replacedEvent(event));
			continue;
		}

		if (event.type === "item.removed") {
			visualEvents.push(removedEvent(event));
			continue;
		}

		if (event.type === "stash.opened") {
			visualEvents.push(stashOpenedEvent(event));
			continue;
		}

		if (event.type === "upgrade.started") {
			visualEvents.push(upgradeStartedEvent(event));
			continue;
		}
	}

	return visualEvents;
};
