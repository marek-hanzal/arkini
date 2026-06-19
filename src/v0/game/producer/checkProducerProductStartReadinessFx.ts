import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/v0/game/requirements/checkActivationInputsFx";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import { readProducerBoardItemFx } from "~/v0/game/producer/readProducerBoardItemFx";
import { readProductFx } from "~/v0/game/producer/readProductFx";
import { readProducerProductLineEnabledFx } from "~/v0/game/producer/readProducerProductLineEnabledFx";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/action/GameActionProducerProductStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerProductStartReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductStart;
	}
}

export const checkProducerProductStartReadinessFx = Effect.fn(
	"checkProducerProductStartReadinessFx",
)(function* ({ config, save, action }: checkProducerProductStartReadinessFx.Props) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	const producerDefinition =
		config.producers[config.items[producerItem.itemId]?.producerId ?? ""];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Producer item "${producerItem.itemId}" references missing producer.`,
			),
		);
	}
	const productId = action.productId ?? producerDefinition.productIds[0];
	if (!productId || !producerDefinition.productIds.includes(productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId ?? "<default>"}" does not belong to producer "${producerDefinition.type}" on item "${producerItem.itemId}".`,
			),
		);
	}

	const productLineEnabled = yield* readProducerProductLineEnabledFx({
		producerItemInstanceId: action.producerItemInstanceId,
		productId,
		save,
	});
	if (!productLineEnabled) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"product_line_disabled",
				`Product line "${productId}" is disabled for producer item "${action.producerItemInstanceId}".`,
			),
		);
	}

	const producerJobCount = Object.values(save.producerJobs).filter(
		(job) => job.producerItemInstanceId === action.producerItemInstanceId,
	).length;
	if (producerJobCount >= producerDefinition.maxQueueSize) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_queue_full",
				`Producer item "${action.producerItemInstanceId}" queue is full (${producerJobCount}/${producerDefinition.maxQueueSize}).`,
			),
		);
	}

	const product = yield* readProductFx({
		productId,
	});
	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.producerItemInstanceId,
	});

	yield* checkGameRequirementsFx({
		config,
		requirements: resolveGameRequirements({
			config,
			requirementIds: producerDefinition.requirementIds,
		}),
		save,
		storedItems,
		targetItemInstanceId: action.producerItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: resolveGameRequirements({
			config,
			requirementIds: product.requirementIds,
		}),
		save,
		storedItems,
		targetItemInstanceId: action.producerItemInstanceId,
	});
	yield* match(product.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
	const productInputs = readProductInputs({
		config,
		productId,
	});
	if (action.inputRefs.length > 0) {
		yield* checkActivationInputsFx({
			inputRefs: action.inputRefs,
			inputs: productInputs,
			save,
		});
	} else {
		const storedInputs = yield* readProducerProductStoredInputQuantitiesFx({
			producerItemInstanceId: action.producerItemInstanceId,
			productId,
			save,
		});
		for (const input of productInputs) {
			const storedQuantity = storedInputs.get(input.itemId) ?? 0;
			if (storedQuantity < input.quantity) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"input_mismatch",
						`Product input "${input.itemId}" quantity mismatch (${storedQuantity}/${input.quantity}).`,
					),
				);
			}
		}
	}

	return {
		producerDefinition,
		producerItem,
		product,
		productId,
		productInputs,
	};
});
