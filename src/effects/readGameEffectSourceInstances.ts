import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEffect } from "~/config/readGameConfigEffects";
import type { GameSave, GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import type { GameEffectSourceInstance } from "~/effects/GameEffectSourceInstance";
import { readWorldActiveEffectFacts } from "~/world/readWorldActiveEffectFacts";

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
	sourceScope: GameEffect["sourceScope"];
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
		return (itemDefinition?.effects ?? []).flatMap((effect) => {
			if (
				!sourceScopeIncludes({
					location: "board",
					sourceScope: effect.sourceScope,
				})
			) {
				return [];
			}

			return [
				{
					effect,
					effectId: effect.id,
					kind: "passive" as const,
					sourceCreatedAtMs: item.createdAtMs ?? 0,
					sourceId: item.id,
					sourceItemInstanceId: item.id,
					sourceLocation: "board" as const,
					startAtMs: item.createdAtMs ?? 0,
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
		return (itemDefinition?.effects ?? []).flatMap((effect) => {
			if (
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
						effect,
						effectId: effect.id,
						kind: "passive" as const,
						sourceCreatedAtMs: slot.createdAtMs ?? 0,
						sourceId: sourceItemInstanceId,
						sourceItemInstanceId,
						sourceLocation: "inventory" as const,
						startAtMs: slot.createdAtMs ?? 0,
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
	}).flatMap(({ definition, effect, sourceLocation, status }) => {
		if (
			status !== "active" ||
			!definition ||
			(effect.producerJobId && ignoredProducerJobIds?.has(effect.producerJobId))
		) {
			return [];
		}

		return [
			{
				effect: definition,
				effectId: definition.id,
				kind: "active" as const,
				sourceCreatedAtMs: effect.startAtMs,
				sourceId: effect.id,
				sourceItemInstanceId: effect.sourceItemInstanceId,
				sourceLocation: sourceLocation ?? "board",
				startAtMs: effect.startAtMs,
			},
		];
	});

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
	];
};
