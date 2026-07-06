import { Effect } from "effect";
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
	resolvedRef: GameActionResolvedInputRef;
};

type ProducerInputStoreReadinessScope = checkProducerInputStoreReadinessFx.Props & {
	readonly declaredLineIds: readonly string[];
	readonly resolvedRef: GameActionResolvedInputRef;
	readonly target: ProducerInputStoreTarget;
	readonly visibleLineIds: readonly string[];
};

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
)(function* ({ lineId, scope }: { lineId: string; scope: ProducerInputStoreReadinessScope }) {
	if (!scope.declaredLineIds.includes(lineId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${lineId}" does not belong to producer "${scope.target.producerId}".`,
			),
		);
	}
	if (scope.visibleLineIds.includes(lineId)) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"invalid_actor",
			`Line "${lineId}" is hidden for the current game state.`,
		),
	);
});

const readProducerInputStoreLineCandidateFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.readProducerInputStoreLineCandidateFx",
)(function* ({ lineId, scope }: { lineId: string; scope: ProducerInputStoreReadinessScope }) {
	yield* assertProducerInputStoreCandidateLineAccessibleFx({
		lineId,
		scope,
	});

	const inputSlot = readLineDefinition({
		producerDefinition: scope.target.producerDefinition,
		lineId,
	})?.inputs?.find((input) => input.itemId === scope.resolvedRef.itemId);
	if (!inputSlot) return undefined;

	const storedInputs = yield* readLineStoredInputQuantitiesFx({
		itemInstanceId: scope.action.itemInstanceId,
		lineId,
		save: scope.save,
	});
	const previousQuantity = readGameItemQuantity({
		itemId: scope.resolvedRef.itemId,
		quantities: storedInputs,
	});
	const remainingQuantity = inputSlot.capacity - previousQuantity;
	const storedQuantity = Math.min(scope.resolvedRef.quantity, remainingQuantity);
	if (storedQuantity <= 0) return undefined;

	return {
		inputSlot,
		lineId,
		nextQuantity: previousQuantity + storedQuantity,
		previousQuantity,
		resolvedRef: {
			...scope.resolvedRef,
			quantity: storedQuantity,
		},
	} satisfies ProducerInputStoreLineCandidate;
});

const readAcceptedProducerInputStoreLineCandidateFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.readAcceptedProducerInputStoreLineCandidateFx",
)(function* ({
	lineIds,
	scope,
}: {
	lineIds: readonly string[];
	scope: ProducerInputStoreReadinessScope;
}) {
	for (const lineId of lineIds) {
		const candidate = yield* readProducerInputStoreLineCandidateFx({
			lineId,
			scope,
		});
		if (candidate) return candidate;
	}

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"input_mismatch",
			`Producer input "${scope.resolvedRef.itemId}" is not accepted by any line with capacity.`,
		),
	);
});

const checkProducerInputStoreReadinessProgramFx = Effect.fn(
	"checkProducerInputStoreReadinessFx.checkProducerInputStoreReadinessProgramFx",
)(function* ({
	lineIds,
	scope,
}: {
	lineIds: readonly string[];
	scope: ProducerInputStoreReadinessScope;
}) {
	const lineCandidate = yield* readAcceptedProducerInputStoreLineCandidateFx({
		lineIds,
		scope,
	});

	return {
		...lineCandidate,
		producerDefinition: scope.target.producerDefinition,
		producerItem: scope.target.producerItem,
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
			scope: {
				...props,
				declaredLineIds,
				resolvedRef,
				target,
				visibleLineIds,
			},
		});
	},
);
