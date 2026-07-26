import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { planLineInputAutofillFx } from "~/engine/input/fx/planLineInputAutofillFx";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailInputsFx } from "~/engine/item-detail/read/readItemDetailInputsFx";
import { readItemDetailOutputFx } from "~/engine/item-detail/read/readItemDetailOutputFx";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readBoardItemDetailLineFx {
	export interface Props {
		readonly activeJob: RuntimeSchema.Type["jobs"][number] | undefined;
		readonly defaultLineId: IdSchema.Type | undefined;
		readonly line: LineSchema.Type;
		readonly ownerHasWork: boolean;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Projects one live board line from canonical start, input, queue, and job truth. */
export const readBoardItemDetailLineFx = Effect.fn("readBoardItemDetailLineFx")(function* ({
	activeJob,
	defaultLineId,
	line,
	ownerHasWork,
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
	const autofillPlan = yield* planLineInputAutofillFx({
		ownerItemId,
		lineId: line.id,
		runtime,
	});
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
	const availability: ItemDetailLines.Line["availability"] = match({
		allInputsReady,
		enabled: resolution.enable,
		ready: start.ready,
	})
		.with(
			{
				ready: true,
			},
			() => ({
				kind: "ready" as const,
			}),
		)
		.with(
			{
				enabled: false,
				ready: false,
			},
			() => ({
				kind: "blocked" as const,
				reason: "disabled" as const,
			}),
		)
		.with(
			{
				allInputsReady: false,
				enabled: true,
				ready: false,
			},
			() => ({
				kind: "blocked" as const,
				reason: "inputs" as const,
			}),
		)
		.with(
			{
				allInputsReady: true,
				enabled: true,
				ready: false,
			},
			() => ({
				kind: "blocked" as const,
				reason: "queue" as const,
			}),
		)
		.exhaustive();

	return {
		lineId: line.id,
		title: line.title,
		description: line.description,
		baseRuntimeMs: line.runtimeMs,
		effectiveRuntimeMs: resolution.runtimeMs,
		availability,
		startMode: ownerHasWork && start.queue.capacity > 1 ? "enqueue" : "start",
		isDefault: line.id === defaultLineId,
		actions: {
			canAutofill: autofillPlan.entry.length > 0,
			canWithdraw,
		},
		input: yield* readItemDetailInputsFx({
			configured: line.input,
			lineId: line.id,
			ownerItemId,
			resolved: resolution.input,
			runtime,
		}),
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
