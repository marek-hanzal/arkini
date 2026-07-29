import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailInputsFx } from "~/engine/item-detail/read/readItemDetailInputsFx";
import { readItemDetailOutputFx } from "~/engine/item-detail/read/readItemDetailOutputFx";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import { resolveLineStartOutputMaxCountFx } from "~/engine/job/fx/read/resolveLineStartOutputMaxCountFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { RuleEnumSchema } from "~/engine/line/schema/rule/RuleEnumSchema";
import type { LineRunResolutionSchema } from "~/engine/line/schema/run/LineRunResolutionSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readBoardItemDetailLineFx {
	export interface Props {
		readonly activeJob: RuntimeSchema.Type["jobs"][number] | undefined;
		readonly defaultLineId: IdSchema.Type | undefined;
		readonly line: LineSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

const readLineDisabledCause = (
	line: LineSchema.Type,
	resolution: LineRunResolutionSchema.Type,
): Extract<
	ItemDetailLines.UnavailableReason,
	{
		readonly kind: "line-disabled";
	}
>["cause"] => {
	for (const [ruleIndex, result] of resolution.rules.entries()) {
		if (result.type !== RuleEnumSchema.enum.Disable || !result.active) continue;
		const rule = line.rules[ruleIndex];
		if (rule?.type !== RuleEnumSchema.enum.Disable) continue;
		return {
			kind: "disable-rule",
			ruleIndex,
			when: rule.when,
		};
	}
	for (const [ruleIndex, result] of resolution.rules.entries()) {
		if (result.type !== RuleEnumSchema.enum.Enable || result.active) continue;
		const rule = line.rules[ruleIndex];
		if (rule?.type !== RuleEnumSchema.enum.Enable) continue;
		const whenIndex = result.failedWhenIndex ?? 0;
		return {
			kind: "enable-rule",
			ruleIndex,
			whenIndex,
			when: rule.when[whenIndex] ?? rule.when[0],
		};
	}
	return {
		kind: "static",
	};
};

/** Projects one live board line from canonical start, input, queue, and job truth. */
export const readBoardItemDetailLineFx = Effect.fn("readBoardItemDetailLineFx")(function* ({
	activeJob,
	defaultLineId,
	line,
	ownerItemId,
	runtime,
}: readBoardItemDetailLineFx.Props) {
	const start = yield* resolveLineStartFx({
		lineId: line.id,
		ownerItemId,
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
		? yield* resolveLineStartOutputMaxCountFx({
				lineId: line.id,
				ownerItemId,
				plan: resolution.plan,
				runtime,
			})
		: undefined;
	const directOutputBlock =
		outputBlock?.kind === "direct-output-max-count" ? outputBlock : undefined;
	const downstreamOutputBlock =
		outputBlock?.kind === "downstream-output-max-count" ? outputBlock : undefined;
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
					cause: readLineDisabledCause(line, resolution),
				},
			}
		: directOutputBlock !== undefined
			? {
					kind: "unavailable",
					reason: {
						kind: "direct-output-max-count",
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
							kind: "downstream-output-max-count",
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
		isDefault: line.id === defaultLineId,
		queuedRequestCount: (runtime.jobQueue ?? []).filter(
			(request) => request.ownerItemId === ownerItemId && request.lineId === line.id,
		).length,
		actions: {
			enqueue: {
				enabled: availability.kind === "available" && start.queue.available,
			},
			canWithdraw,
		},
		input,
		output: yield* readItemDetailOutputFx(line),
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
