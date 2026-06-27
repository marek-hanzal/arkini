import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/v0/game/requirements/checkActivationInputsFx";
import { planProducerProductAutoFillInputRefsFx } from "~/v0/game/producer/planProducerProductAutoFillInputRefsFx";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { readProductFx } from "~/v0/game/producer/readProductFx";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/action/GameActionProducerProductStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";
import { checkProducerChargesAvailableFx } from "~/v0/game/producer/checkProducerChargesAvailableFx";

export namespace checkProducerProductStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionProducerProductStart;
	}
}

export const checkProducerProductStartReadinessFx = Effect.fn(
	"checkProducerProductStartReadinessFx",
)(function* ({ config, nowMs, save, action }: checkProducerProductStartReadinessFx.Props) {
	const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	const visibleProductIds = readVisibleProducerProductIds({
		config,
		producerId,
		producerItemId: producerItem.itemId,
		producerItemInstanceId: action.producerItemInstanceId,
		nowMs,
		productIds: producerDefinition.productIds,
		save,
	});
	const productId =
		action.productId ??
		readProducerDefaultProductId({
			productIds: visibleProductIds,
			producerItemInstanceId: action.producerItemInstanceId,
			save,
		});
	const producerStateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: action.producerItemInstanceId,
		save,
	});
	if (producerStateStatus.craftBusy) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"item_busy",
				`Producer item "${action.producerItemInstanceId}" has a running craft job.`,
			),
		);
	}

	if (!productId || !producerDefinition.productIds.includes(productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId ?? "<default>"}" does not belong to producer "${producerId}" on item "${producerItem.itemId}".`,
			),
		);
	}
	if (!visibleProductIds.includes(productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${productId}" is hidden for the current game state.`,
			),
		);
	}

	const producerJobFacts = readWorldProducerJobFacts({
		nowMs,
		save,
	}).filter((facts) => facts.producerItemInstanceId === action.producerItemInstanceId);
	const producerJobCount = producerJobFacts.length;
	if (producerJobFacts.some((facts) => facts.status === "delivery_blocked")) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_queue_full",
				`Producer item "${action.producerItemInstanceId}" queue is waiting for blocked delivery.`,
			),
		);
	}

	if (producerJobFacts.some((facts) => facts.status === "paused")) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_queue_full",
				`Producer item "${action.producerItemInstanceId}" queue is paused by unmet requirements.`,
			),
		);
	}

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

	const producerRequirements = resolveGameRequirements({
		config,
		requirementIds: producerDefinition.requirementIds,
	});
	const productRequirements = resolveGameRequirements({
		config,
		requirementIds: product.requirementIds,
	});
	yield* checkGameRequirementsFx({
		requirements: producerRequirements,
		save,
		storedItems,
		targetItemInstanceId: action.producerItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		requirements: productRequirements,
		save,
		storedItems,
		targetItemInstanceId: action.producerItemInstanceId,
	});
	const hindrances = [
		...(producerDefinition.hinderedBy ?? []),
		...(product.hinderedBy ?? []),
	];
	const requirements = [
		...producerRequirements,
		...productRequirements,
	];
	yield* match(product.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
	yield* checkProducerChargesAvailableFx({
		config,
		producerId,
		producerItemInstanceId: action.producerItemInstanceId,
		productChargeCost: product.chargeCost,
		save,
	});

	const productInputs = product.inputs ?? [];
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
		const needsAutoFill = productInputs.some(
			(input) =>
				readGameItemQuantity({
					itemId: input.itemId,
					quantities: storedInputs,
				}) < input.quantity,
		);
		if (needsAutoFill) {
			yield* planProducerProductAutoFillInputRefsFx({
				inputs: productInputs,
				producerItemInstanceId: action.producerItemInstanceId,
				productId,
				save,
			});
		}
	}

	return {
		hindrances,
		producerDefinition,
		producerId,
		producerItem,
		product,
		productId,
		productInputs,
		requirements,
	};
});
