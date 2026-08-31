import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemDetailLines } from "~/item-line-detail/type/ItemDetailLines";
import { readItemDetailInputsFx } from "~/item-line-detail/fx/readItemDetailInputsFx";
import { readItemDetailOutputFx } from "~/item-line-detail/fx/readItemDetailOutputFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { resolveActiveJobStatusFx } from "~/production-job/fx/resolveActiveJobStatusFx";
import { resolveStartOutputCapacityFx } from "~/production-job/fx/resolveStartOutputCapacityFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import type { LineRun } from "~/production-line/type/LineRun";
import { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { readEffectiveDefaultLineFn } from "~/production-line/fn/readEffectiveDefaultLineFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { TypeSchema } from "~/production-line/schema/rule/TypeSchema";

const unavailable = {
	kind: "unavailable",
} as const satisfies ItemDetailLines.Result;

const readLineDisabledCauseFn = (
	line: LineSchema.Type,
	resolution: LineRun.Resolution,
): Extract<
	ItemDetailLines.UnavailableReason,
	{
		readonly kind: "line-disabled";
	}
>["cause"] => {
	for (const [ruleIndex, result] of resolution.rules.entries()) {
		if (result.type !== TypeSchema.enum.Disable || !result.active) continue;
		const rule = line.rules[ruleIndex];
		if (rule?.type !== TypeSchema.enum.Disable) continue;
		if (rule.hint === undefined)
			return {
				kind: "static",
			};
		return {
			kind: "disable-rule",
			hint: rule.hint,
			ruleIndex,
			when: rule.when,
		};
	}
	for (const [ruleIndex, result] of resolution.rules.entries()) {
		if (result.type !== TypeSchema.enum.Enable || result.active) continue;
		const rule = line.rules[ruleIndex];
		if (rule?.type !== TypeSchema.enum.Enable) continue;
		if (rule.hint === undefined)
			return {
				kind: "static",
			};
		const whenIndex = result.failedWhenIndex ?? 0;
		return {
			kind: "enable-rule",
			hint: rule.hint,
			ruleIndex,
			whenIndex,
			when: rule.when[whenIndex] ?? rule.when[0],
		};
	}
	return {
		kind: "static",
	};
};

const readBoardItemDetailLineFx = Effect.fn("readBoardItemDetailLineFx")(function* ({
	activeJob,
	defaultLineId,
	line,
	ownerItemId,
	runtime,
}: {
	readonly activeJob: RuntimeSchema.Type["jobs"][number] | undefined;
	readonly defaultLineId: IdSchema.Type | undefined;
	readonly line: LineSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const start = yield* resolveLineStartFx({
		lineId: line.id,
		ownerItemId,
		runtime,
	});
	const owner = yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const resolution = start.run;
	if (!resolution.show && activeJob === undefined) return undefined;
	const allInputsReady = resolution.input.every((input) => input.resolution.ready);
	const canWithdraw = runtime.items.some(
		(item) =>
			item.location.scope === LocationScopeEnumSchema.enum.Input &&
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === line.id,
	);
	const activeJobStatus =
		activeJob === undefined
			? undefined
			: yield* resolveActiveJobStatusFx({
					job: activeJob,
					runtime,
				});
	const outputBlock = resolution.enable
		? yield* resolveStartOutputCapacityFx({
				lineId: line.id,
				ownerItemId,
				plan: resolution.plan,
				runtime,
			})
		: undefined;
	const directOutputBlock =
		outputBlock?.kind === "direct-output-capacity" ? outputBlock : undefined;
	const downstreamOutputBlock =
		outputBlock?.kind === "downstream-output-capacity" ? outputBlock : undefined;
	const input = yield* readItemDetailInputsFx({
		configured: line.input,
		lineId: line.id,
		ownerItemId,
		resolved: resolution.input,
		runtime,
	});
	const missingDepositTarget = input.find(
		(candidate) => candidate.kind === "deposit" && candidate.targetItemIds.length === 0,
	);
	const availability: ItemDetailLines.Line["availability"] = !resolution.enable
		? {
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
					cause: readLineDisabledCauseFn(line, resolution),
				},
			}
		: directOutputBlock !== undefined
			? {
					kind: "unavailable",
					reason: {
						kind: "direct-output-capacity",
						itemId: directOutputBlock.itemId,
						liveQuantity: directOutputBlock.liveQuantity,
						reservedQuantity: directOutputBlock.reservedQuantity,
						maxCount: directOutputBlock.maxCount,
					},
				}
			: downstreamOutputBlock !== undefined
				? {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-capacity",
							intermediateItemId: downstreamOutputBlock.intermediateItemId,
							itemId: downstreamOutputBlock.itemId,
							liveQuantity: downstreamOutputBlock.liveQuantity,
							reservedQuantity: downstreamOutputBlock.reservedQuantity,
							maxCount: downstreamOutputBlock.maxCount,
						},
					}
				: missingDepositTarget?.kind === "deposit"
					? {
							kind: "unavailable",
							reason: {
								kind: "deposit-target-missing",
								selector: missingDepositTarget.selector,
								distance: missingDepositTarget.distance,
							},
						}
					: {
							kind: "available",
							readiness: start.ready ? "ready" : allInputsReady ? "queue" : "inputs",
						};
	return {
		lineId: line.id,
		title: line.title,
		description: line.description,
		baseRuntimeMs: line.runtimeMs,
		effectiveRuntimeMs: resolution.runtimeMs,
		availability,
		activeRuleHints: resolution.rules.flatMap((result, ruleIndex) => {
			const hint = line.rules[ruleIndex]?.hint;
			return result.active && hint !== undefined
				? [
						hint,
					]
				: [];
		}),
		isDefault: line.id === defaultLineId,
		queuedRequestCount: runtime.jobQueue.filter(
			(request) => request.ownerItemId === ownerItemId && request.lineId === line.id,
		).length,
		actions: {
			enqueue: {
				enabled: availability.kind === "available" && start.queue.available,
			},
			canWithdraw,
		},
		input,
		output: yield* readItemDetailOutputFx({
			line,
			ruleContext: {
				origin: owner.location,
				runtime,
			},
		}),
		...(activeJob === undefined
			? {}
			: {
					activeJob: {
						status: activeJobStatus ?? JobStatusEnumSchema.enum.Paused,
						durationMs: activeJob.durationMs,
						remainingMs: activeJob.remainingMs,
					},
				}),
	} satisfies ItemDetailLines.Line;
});

const readStoredItemDetailLineFx = Effect.fn("readStoredItemDetailLineFx")(function* ({
	activeJob,
	line,
	ownerItemId,
	runtime,
	isDefault,
}: {
	readonly activeJob: RuntimeSchema.Type["jobs"][number] | undefined;
	readonly line: LineSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly isDefault: boolean;
}) {
	return {
		lineId: line.id,
		title: line.title,
		description: line.description,
		baseRuntimeMs: line.runtimeMs,
		effectiveRuntimeMs: line.runtimeMs,
		availability: {
			kind: "unavailable",
			reason: {
				kind: "owner-stored",
			},
		},
		activeRuleHints: [],
		isDefault,
		queuedRequestCount: runtime.jobQueue.filter(
			(request) => request.ownerItemId === ownerItemId && request.lineId === line.id,
		).length,
		actions: {
			enqueue: {
				enabled: false,
			},
			canWithdraw: false,
		},
		input: yield* readItemDetailInputsFx({
			configured: line.input,
			lineId: line.id,
			ownerItemId,
			runtime,
		}),
		output: yield* readItemDetailOutputFx({
			line,
		}),
		...(activeJob === undefined
			? {}
			: {
					activeJob: {
						status: JobStatusEnumSchema.enum.Paused,
						durationMs: activeJob.durationMs,
						remainingMs: activeJob.remainingMs,
					},
				}),
	} satisfies ItemDetailLines.Line;
});

/** Projects the visible read-only product lines of one exact live line owner. */
export const readItemDetailLinesFx = Effect.fn("readItemDetailLinesFx")(function* ({
	itemId,
	runtime,
}: ItemDetailLines.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner === undefined) return unavailable;
	const ownerItem = Option.getOrUndefined(isLineOwnerItemFn(owner.item));
	if (ownerItem === undefined) return unavailable;

	const lines = readLineOwnerLinesFn(ownerItem);
	const defaultLineId = readEffectiveDefaultLineFn({
		ownerItemId: owner.id,
		ownerItem,
		runtime,
	})?.id;
	const projected: ItemDetailLines.Line[] = [];

	for (const line of lines) {
		const activeJob = runtime.jobs.find(
			(job) => job.ownerItemId === owner.id && job.lineId === line.id,
		);
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			if (!line.show && activeJob === undefined) continue;
			projected.push(
				yield* readStoredItemDetailLineFx({
					activeJob,
					line,
					ownerItemId: owner.id,
					runtime,
					isDefault: line.id === defaultLineId,
				}),
			);
			continue;
		}

		const boardLine = yield* readBoardItemDetailLineFx({
			activeJob,
			defaultLineId,
			line,
			ownerItemId: owner.id,
			runtime,
		});
		if (boardLine !== undefined) projected.push(boardLine);
	}

	const activeLineId = projected.find((line) => line.activeJob !== undefined)?.lineId;
	const visibleLineIds = new Set(projected.map((line) => line.lineId));
	const earliestQueuedLineId = runtime.jobQueue.find(
		(request) => request.ownerItemId === owner.id,
	)?.lineId;
	const queuedLineId =
		earliestQueuedLineId !== undefined && visibleLineIds.has(earliestQueuedLineId)
			? earliestQueuedLineId
			: undefined;
	const focusLineId = activeLineId ?? queuedLineId;
	return {
		kind: "available",
		itemId: owner.id,
		...(focusLineId === undefined
			? {}
			: {
					focusLineId,
				}),
		line: projected,
	} satisfies ItemDetailLines.Result;
});
