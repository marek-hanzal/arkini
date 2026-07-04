import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import {
	readNearbyCapacitySpendSource,
	type NearbyCapacitySpendEffect,
} from "~/capacity/readNearbyCapacitySpendSource";

export namespace spendLineCapacityEffectsFx {
	export interface Props {
		config: GameConfig;
		itemInstanceId: string;
		line: GameLineDefinition;
		nextSave: GameSave;
		nowMs: number;
	}
}

const createCapacityChangedEvent = ({
	amount,
	max,
	nextRemaining,
	nowMs,
	previousRemaining,
	sourceItemId,
	sourceItemInstanceId,
}: {
	amount: number;
	max: number;
	nextRemaining: number;
	nowMs: number;
	previousRemaining: number;
	sourceItemId: string;
	sourceItemInstanceId: string;
}) =>
	({
		amount,
		atMs: nowMs,
		itemId: sourceItemId,
		itemInstanceId: sourceItemInstanceId,
		max,
		nextRemaining,
		previousRemaining,
		type: "item.capacity.changed" as const,
	}) satisfies GameEvent;

const createCapacityDepletedEvent = ({
	nowMs,
	sourceItemId,
	sourceItemInstanceId,
}: {
	nowMs: number;
	sourceItemId: string;
	sourceItemInstanceId: string;
}) =>
	({
		atMs: nowMs,
		itemId: sourceItemId,
		itemInstanceId: sourceItemInstanceId,
		type: "item.capacity.depleted" as const,
	}) satisfies GameEvent;

const applyDepletionFx = Effect.fn("spendLineCapacityEffectsFx.applyDepletionFx")(function* ({
	config,
	events,
	nextSave,
	nowMs,
	sourceItemId,
	sourceItemInstanceId,
}: {
	config: GameConfig;
	events: GameEvent[];
	nextSave: GameSave;
	nowMs: number;
	sourceItemId: string;
	sourceItemInstanceId: string;
}) {
	const sourceItem = nextSave.board.items[sourceItemInstanceId];
	const capacity = config.items[sourceItemId]?.capacity;
	if (!sourceItem || !capacity || capacity.onDepleted === "stop") return;

	if (capacity.onDepleted === "replace") {
		nextSave.board.items[sourceItemInstanceId] = {
			...sourceItem,
			createdAtMs: config.items[capacity.replaceItemId]?.effects
				? nowMs
				: sourceItem.createdAtMs,
			itemId: capacity.replaceItemId,
		};
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: sourceItemInstanceId,
			save: nextSave,
		});
		events.push({
			atMs: nowMs,
			fromItemId: sourceItemId,
			itemInstanceId: sourceItemInstanceId,
			reason: "capacity-depleted" as const,
			toItemId: capacity.replaceItemId,
			type: "item.replaced" as const,
		});
		return;
	}

	delete nextSave.board.items[sourceItemInstanceId];
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: sourceItemInstanceId,
		save: nextSave,
	});
	events.push({
		atMs: nowMs,
		itemId: sourceItemId,
		itemInstanceId: sourceItemInstanceId,
		reason: "capacity-depleted" as const,
		type: "item.removed" as const,
	});
});

const readCapacitySpendEffects = (line: GameLineDefinition) =>
	(line.effects ?? []).filter(
		(effect): effect is NearbyCapacitySpendEffect => effect.kind === "nearby.capacity.spend",
	);

export const spendLineCapacityEffectsFx = Effect.fn("spendLineCapacityEffectsFx")(function* ({
	config,
	itemInstanceId,
	line,
	nextSave,
	nowMs,
}: spendLineCapacityEffectsFx.Props) {
	const events: GameEvent[] = [];

	for (const effect of readCapacitySpendEffects(line)) {
		const source = readNearbyCapacitySpendSource({
			config,
			effect,
			itemInstanceId,
			save: nextSave,
		});
		if (!source) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"effect:missing-capacity",
					`Line "${line.id}" has no nearby source with at least ${effect.amount} capacity.`,
				),
			);
		}

		const nextRemaining = Math.max(0, source.remaining - effect.amount);
		nextSave.itemCapacities[source.itemInstanceId] = {
			remaining: nextRemaining,
		};
		events.push(
			createCapacityChangedEvent({
				amount: effect.amount,
				max: source.max,
				nextRemaining,
				nowMs,
				previousRemaining: source.remaining,
				sourceItemId: source.itemId,
				sourceItemInstanceId: source.itemInstanceId,
			}),
		);

		if (nextRemaining > 0) continue;

		events.push(
			createCapacityDepletedEvent({
				nowMs,
				sourceItemId: source.itemId,
				sourceItemInstanceId: source.itemInstanceId,
			}),
		);
		yield* applyDepletionFx({
			config,
			events,
			nextSave,
			nowMs,
			sourceItemId: source.itemId,
			sourceItemInstanceId: source.itemInstanceId,
		});
	}

	return events;
});
