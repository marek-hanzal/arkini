import { Context, Effect } from "effect";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActionProducerInputStoreSchema } from "~/action/GameActionProducerInputStoreSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	readLineDefinition,
	readLineIds,
	type GameLineDefinition,
	type GameProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readLineIdsByPriority } from "~/producer/readLineIdsByPriority";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace checkProducerInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionProducerInputStoreSchema.Type;
	}
}

type ProducerInputStoreTarget = {
	producerDefinition: GameProducerCapabilityDefinition;
	producerId: string;
	producerItem: GameSave["board"]["items"][string];
};

type ProducerInputStoreLineCandidate = {
	inputSlot: NonNullable<GameLineDefinition["inputs"]>[number];
	lineId: string;
	nextQuantity: number;
	previousQuantity: number;
};

class ProducerInputStoreReadinessScopeFx extends Context.Tag("ProducerInputStoreReadinessScopeFx")<
	ProducerInputStoreReadinessScopeFx,
	checkProducerInputStoreReadinessFx.Props & {
		readonly declaredLineIds: readonly string[];
		readonly resolvedRef: GameActionResolvedInputRef;
		readonly target: ProducerInputStoreTarget;
		readonly visibleLineIds: readonly string[];
	}
>() {
	//
}

const readProducerInputStoreTargetFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.readProducerInputStoreTargetFx",
)(function* ({ config, save, action }: checkProducerInputStoreReadinessFx.Props) {
	return yield* readProducerRuntimeTargetFx({
		config,
		itemInstanceId: action.itemInstanceId,
		save,
	});
});

const readProducerInputStoreResolvedRefFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.readProducerInputStoreResolvedRefFx",
)(function* ({ action, save }: Pick<checkProducerInputStoreReadinessFx.Props, "action" | "save">) {
	const resolvedRef = yield* resolveSingleInputRefFx({
		inputRef: action.inputRef,
		missingMessage: "Missing producer input.",
		save,
	});
	yield* assertResolvedInputRefIsNotBoardItemFx({
		inputRef: resolvedRef,
		message: "Producer input target cannot store itself.",
		targetItemInstanceId: action.itemInstanceId,
	});
	return resolvedRef;
});

const readProducerInputStoreVisibleLineIds = ({
	action,
	config,
	declaredLineIds,
	nowMs,
	save,
	target,
}: checkProducerInputStoreReadinessFx.Props & {
	declaredLineIds: readonly string[];
	target: ProducerInputStoreTarget;
}) =>
	readVisibleLineIds({
		config,
		producerDefinition: target.producerDefinition,
		itemInstanceId: action.itemInstanceId,
		lineIds: declaredLineIds,
		nowMs,
		save,
	});

const readProducerInputStoreCandidateLineIds = ({
	action,
	save,
	visibleLineIds,
}: checkProducerInputStoreReadinessFx.Props & {
	visibleLineIds: readonly string[];
}) =>
	action.lineId
		? [
				action.lineId,
			]
		: readLineIdsByPriority({
				lineIds: visibleLineIds,
				itemInstanceId: action.itemInstanceId,
				save,
			});

const assertProducerInputStoreCandidateLineAccessibleFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.assertProducerInputStoreCandidateLineAccessibleFx",
)(function* ({ lineId }: { lineId: string }) {
	const { declaredLineIds, target, visibleLineIds } = yield* ProducerInputStoreReadinessScopeFx;
	if (!declaredLineIds.includes(lineId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${lineId}" does not belong to producer "${target.producerId}".`,
			),
		);
	}
	if (visibleLineIds.includes(lineId)) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"invalid_actor",
			`Line "${lineId}" is hidden for the current game state.`,
		),
	);
});

const readProducerInputStoreLineCandidateFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.readProducerInputStoreLineCandidateFx",
)(function* ({ lineId }: { lineId: string }) {
	const { action, save, resolvedRef, target } = yield* ProducerInputStoreReadinessScopeFx;
	yield* assertProducerInputStoreCandidateLineAccessibleFx({
		lineId,
	});

	const inputSlot = readLineDefinition({
		producerDefinition: target.producerDefinition,
		lineId,
	})?.inputs?.find((input) => input.itemId === resolvedRef.itemId);
	if (!inputSlot) return undefined;

	const storedInputs = yield* readLineStoredInputQuantitiesFx({
		itemInstanceId: action.itemInstanceId,
		lineId,
		save,
	});
	const previousQuantity = readGameItemQuantity({
		itemId: resolvedRef.itemId,
		quantities: storedInputs,
	});
	const nextQuantity = previousQuantity + resolvedRef.quantity;
	if (nextQuantity > inputSlot.capacity) return undefined;

	return {
		inputSlot,
		lineId,
		nextQuantity,
		previousQuantity,
	} satisfies ProducerInputStoreLineCandidate;
});

const readAcceptedProducerInputStoreLineCandidateFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.readAcceptedProducerInputStoreLineCandidateFx",
)(function* ({ lineIds }: { lineIds: readonly string[] }) {
	for (const lineId of lineIds) {
		const candidate = yield* readProducerInputStoreLineCandidateFx({
			lineId,
		});
		if (candidate) return candidate;
	}

	const { resolvedRef } = yield* ProducerInputStoreReadinessScopeFx;
	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"input_mismatch",
			`Producer input "${resolvedRef.itemId}" is not accepted by any line with capacity.`,
		),
	);
});

const checkProducerInputStoreReadinessProgramFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.checkProducerInputStoreReadinessProgramFx",
)(function* ({ lineIds }: { lineIds: readonly string[] }) {
	const { resolvedRef, target } = yield* ProducerInputStoreReadinessScopeFx;
	const lineCandidate = yield* readAcceptedProducerInputStoreLineCandidateFx({
		lineIds,
	});

	return {
		...lineCandidate,
		producerDefinition: target.producerDefinition,
		producerItem: target.producerItem,
		resolvedRef,
	};
});

export const checkProducerInputStoreReadinessFx = Effect.fn("checkProducerInputStoreReadinessFx")(
	function* (props: checkProducerInputStoreReadinessFx.Props) {
		const target = yield* readProducerInputStoreTargetFx(props);
		const resolvedRef = yield* readProducerInputStoreResolvedRefFx(props);
		const declaredLineIds = readLineIds({
			producerDefinition: target.producerDefinition,
		});
		const visibleLineIds = readProducerInputStoreVisibleLineIds({
			...props,
			declaredLineIds,
			target,
		});
		const lineIds = readProducerInputStoreCandidateLineIds({
			...props,
			visibleLineIds,
		});

		return yield* checkProducerInputStoreReadinessProgramFx({
			lineIds,
		}).pipe(
			Effect.provideService(ProducerInputStoreReadinessScopeFx, {
				...props,
				declaredLineIds,
				resolvedRef,
				target,
				visibleLineIds,
			}),
		);
	},
);
