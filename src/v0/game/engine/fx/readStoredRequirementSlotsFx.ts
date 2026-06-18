import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameRequirement } from "~/v0/game/engine/model/GameRequirement";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readStoredRequirementSlotsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readStoredRequirementSlotsFx = Effect.fn("readStoredRequirementSlotsFx")(function* ({
	config,
	save,
	targetItemInstanceId,
}: readStoredRequirementSlotsFx.Props) {
	const targetItem = save.board.items[targetItemInstanceId];
	if (!targetItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				`Stored requirement target "${targetItemInstanceId}" is not on the board.`,
			),
		);
	}

	const item = config.items[targetItem.itemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${targetItem.itemId}".`),
		);
	}

	const requirements: GameRequirement[] = [];

	if (item.producerId) {
		const producer = config.producers[item.producerId];
		if (!producer) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Producer item "${targetItem.itemId}" references missing producer "${item.producerId}".`,
				),
			);
		}

		requirements.push(...producer.requirements);
		for (const productId of producer.productIds) {
			const product = config.products[productId];
			if (!product) {
				return yield* Effect.fail(
					GameEngineError.configReferenceMissing(
						`Producer "${item.producerId}" references missing product "${productId}".`,
					),
				);
			}
			requirements.push(...product.requirements);
		}
	}

	if (item.stashId) {
		const stash = config.stashes[item.stashId];
		if (!stash) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Stash item "${targetItem.itemId}" references missing stash "${item.stashId}".`,
				),
			);
		}

		requirements.push(...stash.requirements);
	}

	const storedRequirements = requirements.filter(
		(
			requirement,
		): requirement is Extract<
			GameRequirement,
			{
				type: "stored";
			}
		> => requirement.type === "stored",
	);

	if (storedRequirements.length === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_requirement",
				`Target "${targetItemInstanceId}" has no stored requirement slots.`,
			),
		);
	}

	return {
		storedRequirements,
		targetItem,
	};
});
