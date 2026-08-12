import { Effect } from "effect";

import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { PlannerActionOutputWitness } from "~/editor/planner/PlannerActionOutputWitness";
import type {
	PlannerActionAttempt,
	PlannerActionResult,
} from "~/editor/planner/PlannerActionResult";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { makePlannerGamePolicyLayerFx } from "~/engine/game/layer/PlannerGamePolicyLayerFx";
import { completeTemporaryExpiryIntentRuntimeFx } from "~/engine/item/temporary/fx/completeTemporaryExpiryIntentRuntimeFx";
import { completeLineIntentRuntimeFx } from "~/engine/job/fx/completeLineIntentRuntimeFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { mergeItemIntentRuntimeFx } from "~/engine/merge/fx/mergeItemIntentRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";

export namespace runPlannerActionFx {
	export interface Props {
		readonly action: PlannerAction;
		readonly outputWitness?: PlannerActionOutputWitness;
		readonly runtime: RuntimeSchema.Type;
	}
}

const readLineAttempts = (
	attempts: readonly completeLineIntentRuntimeFx.Attempt[],
): PlannerActionAttempt[] =>
	attempts.map(
		({ causeTag, missingQuantity, ownerRuntimeItemId, relatedRuntimeItemId, stage }) => ({
			failureTag: causeTag,
			...(missingQuantity === undefined
				? {}
				: {
						missingQuantity,
					}),
			...(relatedRuntimeItemId === undefined
				? {}
				: {
						relatedRuntimeItemId,
					}),
			runtimeItemId: ownerRuntimeItemId,
			stage,
		}),
	);

const hasAuthoredMergeFx = Effect.fn("runPlannerActionFx.hasAuthoredMergeFx")(function* (
	action: Extract<
		PlannerAction,
		{
			readonly kind: "merge";
		}
	>,
) {
	const config = yield* GameConfigFx;
	const source = config.items[action.sourceItemId];
	const target = config.items[action.targetItemId];
	if (source === undefined || target === undefined) return false;

	for (const [mergeIndex, rule] of (source.merge ?? []).entries()) {
		const matches = yield* selectItemsFx({
			items: [
				target,
			],
			selector: rule.target,
		});
		if (matches.length === 0) continue;
		return mergeIndex === action.mergeIndex;
	}
	return false;
});

const runLineActionFx = Effect.fn("runPlannerActionFx.line")(function* ({
	action,
	runtime,
}: {
	readonly action: Extract<
		PlannerAction,
		{
			readonly kind: "line";
		}
	>;
	readonly runtime: RuntimeSchema.Type;
}) {
	const config = yield* GameConfigFx;
	const owner = config.items[action.ownerItemId];
	const line =
		owner === undefined
			? undefined
			: yield* readItemLineFx({
					item: owner,
					lineId: action.lineId,
				});
	if (line === undefined) {
		return {
			action,
			reason: {
				code: "authored-transition-missing",
			},
			runtime,
			type: "unsupported",
		} satisfies PlannerActionResult;
	}

	const result = yield* completeLineIntentRuntimeFx({
		lineId: action.lineId,
		ownerItemId: action.ownerItemId,
		runtime,
	});
	if (result.type === "unsupported") {
		return {
			action,
			reason: {
				code: result.reason,
				runtimeMs: result.runtimeMs,
			},
			runtime,
			type: "unsupported",
		} satisfies PlannerActionResult;
	}
	if (result.type === "blocked") {
		return {
			action,
			blocker:
				result.reason === "owner-unavailable"
					? {
							code: "runtime-item-missing",
							itemId: action.ownerItemId,
							role: "owner",
						}
					: {
							attempt: readLineAttempts(result.attempt),
							code: "action-rejected",
						},
			runtime,
			type: "blocked",
		} satisfies PlannerActionResult;
	}
	return {
		action,
		actor: {
			jobId: result.jobId,
			kind: "line",
			ownerRuntimeItemId: result.ownerRuntimeItemId,
		},
		elapsedMs: result.elapsedMs,
		events: result.events,
		outputWitnessResolved: false,
		runtime: result.runtime,
		type: "completed",
	} satisfies PlannerActionResult;
});

const runMergeActionFx = Effect.fn("runPlannerActionFx.merge")(function* ({
	action,
	runtime,
}: {
	readonly action: Extract<
		PlannerAction,
		{
			readonly kind: "merge";
		}
	>;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (!(yield* hasAuthoredMergeFx(action))) {
		return {
			action,
			reason: {
				code: "authored-transition-missing",
			},
			runtime,
			type: "unsupported",
		} satisfies PlannerActionResult;
	}

	const result = yield* mergeItemIntentRuntimeFx({
		mergeIndex: action.mergeIndex,
		runtime,
		sourceItemId: action.sourceItemId,
		targetItemId: action.targetItemId,
	});
	if (result.type === "blocked") {
		const blocker = !result.sourceAvailable
			? {
					code: "runtime-item-missing" as const,
					itemId: action.sourceItemId,
					role: "merge-source" as const,
				}
			: !result.targetAvailable
				? {
						code: "runtime-item-missing" as const,
						itemId: action.targetItemId,
						role: "merge-target" as const,
					}
				: {
						attempt: result.attempt.map(
							({ failureTag, sourceRuntimeItemId, targetRuntimeItemId }) => ({
								failureTag,
								relatedRuntimeItemId: targetRuntimeItemId,
								runtimeItemId: sourceRuntimeItemId,
								stage: "merge" as const,
							}),
						),
						code: "action-rejected" as const,
					};
		return {
			action,
			blocker,
			runtime,
			type: "blocked",
		} satisfies PlannerActionResult;
	}
	return {
		action,
		actor: {
			kind: "merge",
			sourceRuntimeItemId: result.sourceRuntimeItemId,
			targetRuntimeItemId: result.targetRuntimeItemId,
		},
		elapsedMs: 0,
		events: result.events,
		outputWitnessResolved: false,
		runtime: result.runtime,
		type: "completed",
	} satisfies PlannerActionResult;
});

const runTemporaryExpiryActionFx = Effect.fn("runPlannerActionFx.temporaryExpiry")(function* ({
	action,
	runtime,
}: {
	readonly action: Extract<
		PlannerAction,
		{
			readonly kind: "temporary-expiry";
		}
	>;
	readonly runtime: RuntimeSchema.Type;
}) {
	const config = yield* GameConfigFx;
	const item = config.items[action.itemId];
	if (item?.type !== "temporary") {
		return {
			action,
			reason: {
				code: "authored-transition-missing",
			},
			runtime,
			type: "unsupported",
		} satisfies PlannerActionResult;
	}

	const result = yield* completeTemporaryExpiryIntentRuntimeFx({
		itemId: action.itemId,
		runtime,
	});
	if (result.type === "unsupported") {
		return {
			action,
			reason: {
				code: result.reason,
				runtimeMs: result.runtimeMs,
			},
			runtime,
			type: "unsupported",
		} satisfies PlannerActionResult;
	}
	if (result.type === "blocked") {
		return {
			action,
			blocker: result.itemAvailable
				? {
						attempt: result.attempt.map(({ failureTag, itemRuntimeId }) => ({
							failureTag,
							runtimeItemId: itemRuntimeId,
							stage: "expire",
						})),
						code: "action-rejected",
					}
				: {
						code: "runtime-item-missing",
						itemId: action.itemId,
						role: "temporary",
					},
			runtime,
			type: "blocked",
		} satisfies PlannerActionResult;
	}
	return {
		action,
		actor: {
			itemRuntimeId: result.itemRuntimeId,
			kind: "temporary-expiry",
		},
		elapsedMs: result.elapsedMs,
		events: result.events,
		outputWitnessResolved: false,
		runtime: result.runtime,
		type: "completed",
	} satisfies PlannerActionResult;
});

const runPlannerActionWithPoliciesFx = Effect.fn("runPlannerActionFx.withPolicies")(function* ({
	action,
	runtime,
}: runPlannerActionFx.Props) {
	switch (action.kind) {
		case "line":
			return yield* runLineActionFx({
				action,
				runtime,
			});
		case "merge":
			return yield* runMergeActionFx({
				action,
				runtime,
			});
		case "temporary-expiry":
			return yield* runTemporaryExpiryActionFx({
				action,
				runtime,
			});
	}
});

const readUnexpectedFailureStage = (action: PlannerAction): PlannerActionAttempt["stage"] => {
	switch (action.kind) {
		case "line":
			return "complete";
		case "merge":
			return "merge";
		case "temporary-expiry":
			return "expire";
	}
};

const readFailureTag = (failure: unknown) => {
	if (
		typeof failure === "object" &&
		failure !== null &&
		"_tag" in failure &&
		typeof failure._tag === "string"
	)
		return failure._tag;
	return "PlannerActionFailure";
};

/** Runs one authored action against an immutable runtime under optimistic planner policies. */
export const runPlannerActionFx = (props: runPlannerActionFx.Props) =>
	Effect.suspend(() => {
		let outputWitnessResolved = false;
		return runPlannerActionWithPoliciesFx(props).pipe(
			Effect.provide(
				makePlannerGamePolicyLayerFx(
					props.outputWitness === undefined
						? undefined
						: {
								onResolved: () => {
									outputWitnessResolved = true;
								},
								source: props.outputWitness.source,
								witness: props.outputWitness.witness,
							},
				),
			),
			Effect.map((result) =>
				result.type === "completed"
					? {
							...result,
							outputWitnessResolved,
						}
					: result,
			),
			Effect.catch((failure) =>
				Effect.succeed({
					action: props.action,
					blocker: {
						attempt: [
							{
								failureTag: readFailureTag(failure),
								stage: readUnexpectedFailureStage(props.action),
							},
						],
						code: "action-rejected",
					},
					runtime: props.runtime,
					type: "blocked",
				} satisfies PlannerActionResult),
			),
		);
	});
