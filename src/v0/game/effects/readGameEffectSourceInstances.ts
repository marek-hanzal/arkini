import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";

export namespace readGameEffectSourceInstances {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs?: number;
		save: GameSave;
	}
}

const sourceScopeIncludes = ({
	location,
	sourceScope,
}: {
	location: GameEffectSourceInstance["sourceLocation"];
	sourceScope: GameConfig["effects"][string]["sourceScope"];
}) => (sourceScope ?? "board") === "both" || (sourceScope ?? "board") === location;

const readPassiveBoardSources = ({
	config,
	save,
}: {
	config: GameConfig;
	save: GameSave;
}): GameEffectSourceInstance[] =>
	Object.values(save.board.items).flatMap((item) => {
		const itemDefinition = config.items[item.itemId];
		return (itemDefinition?.passiveEffectIds ?? []).flatMap((effectId) => {
			const effect = config.effects[effectId];
			if (
				!effect ||
				!sourceScopeIncludes({
					location: "board",
					sourceScope: effect.sourceScope,
				})
			) {
				return [];
			}

			return [
				{
					startAtMs: item.createdAtMs ?? 0,
					effectId,
					kind: "passive" as const,
					sourceId: item.id,
					sourceCreatedAtMs: item.createdAtMs ?? 0,
					sourceItemInstanceId: item.id,
					sourceLocation: "board" as const,
				},
			];
		});
	});

const readInventorySlotQuantity = (slot: NonNullable<GameSaveInventorySlot>) => {
	if ("kind" in slot) return 1;
	return slot.quantity;
};

const readInventorySlotSourceInstanceId = ({
	quantityIndex,
	slot,
	slotIndex,
}: {
	quantityIndex: number;
	slot: NonNullable<GameSaveInventorySlot>;
	slotIndex: number;
}) =>
	"kind" in slot && slot.kind === "instance"
		? slot.id
		: `inventory-slot:${slotIndex}:${slot.itemId}:${quantityIndex}`;

const readPassiveInventorySources = ({
	config,
	save,
}: {
	config: GameConfig;
	save: GameSave;
}): GameEffectSourceInstance[] =>
	save.inventory.slots.flatMap((slot, slotIndex) => {
		if (!slot) return [];

		const itemDefinition = config.items[slot.itemId];
		return (itemDefinition?.passiveEffectIds ?? []).flatMap((effectId) => {
			const effect = config.effects[effectId];
			if (
				!effect ||
				!sourceScopeIncludes({
					location: "inventory",
					sourceScope: effect.sourceScope,
				})
			) {
				return [];
			}

			return Array.from(
				{
					length: readInventorySlotQuantity(slot),
				},
				(_, quantityIndex) => {
					const sourceItemInstanceId = readInventorySlotSourceInstanceId({
						quantityIndex,
						slot,
						slotIndex,
					});

					return {
						startAtMs: slot.createdAtMs ?? 0,
						effectId,
						kind: "passive" as const,
						sourceId: sourceItemInstanceId,
						sourceCreatedAtMs: slot.createdAtMs ?? 0,
						sourceItemInstanceId,
						sourceLocation: "inventory" as const,
					};
				},
			);
		});
	});

export const readGameEffectSourceInstances = ({
	config,
	ignoredProducerJobIds,
	nowMs,
	save,
}: readGameEffectSourceInstances.Props): GameEffectSourceInstance[] => {
	const activeSources = readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	})
		.filter(
			(effectFacts) =>
				effectFacts.status === "active" &&
				(!effectFacts.effect.producerJobId ||
					!ignoredProducerJobIds?.has(effectFacts.effect.producerJobId)),
		)
		.map(({ effect, sourceLocation }) => ({
			startAtMs: effect.startAtMs,
			effectId: effect.effectId,
			kind: "active" as const,
			sourceId: effect.id,
			sourceCreatedAtMs: effect.startAtMs,
			sourceItemInstanceId: effect.sourceItemInstanceId,
			sourceLocation: sourceLocation ?? "board",
		}));

	return [
		...readPassiveBoardSources({
			config,
			save,
		}),
		...readPassiveInventorySources({
			config,
			save,
		}),
		...activeSources,
	].filter((source) => Boolean(config.effects[source.effectId]));
};
