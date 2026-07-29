import { Effect, Option, Result } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { readItemQueueSizeFx } from "~/engine/job/read/readItemQueueSizeFx";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readLineInputAutofillCoverageFx } from "~/engine/input/fx/readLineInputAutofillCoverageFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { assertLineOutputMaxCountFx } from "~/engine/job/fx/assertLineOutputMaxCountFx";
import { assertLineEnqueueConditionsFx } from "~/engine/job/fx/assertLineEnqueueConditionsFx";

interface ItemDetailQueueRequest {
	readonly requestId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly title: string;
	readonly outputItemId?: IdSchema.Type;
	readonly status: "inputs-ready" | "waiting-inputs" | "blocked-earlier" | "blocked-condition";
	readonly missingQuantity?: number;
}

interface ItemDetailQueueActiveJob {
	readonly jobId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly title: string;
	readonly outputItemId?: IdSchema.Type;
	readonly status: JobStatusEnumSchema.Type;
	readonly durationMs: number;
	readonly remainingMs: number;
}

export namespace readItemDetailQueueFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly capacity: number;
				readonly active: readonly ItemDetailQueueActiveJob[];
				readonly request: readonly ItemDetailQueueRequest[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailQueueFx.Result;

const readPrimaryOutputItemId = (line: LineSchema.Type | undefined) => {
	const roll = line?.output?.set[0]?.roll[0];
	if (roll === undefined) return undefined;
	return roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;
};

/** Projects active and queued line work for one exact line owner. */
export const readItemDetailQueueFx = Effect.fn("readItemDetailQueueFx")(function* ({
	itemId,
	runtime,
}: readItemDetailQueueFx.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner === undefined) return unavailable;
	const lineOwner = yield* isLineOwnerItemFx(owner.item);
	if (Option.isNone(lineOwner)) return unavailable;
	const capacity = yield* readItemQueueSizeFx({
		item: lineOwner.value,
	});
	if (capacity === undefined) return unavailable;
	const lineById = new Map(
		(yield* readLineOwnerLinesFx(lineOwner.value)).map((line) => [
			line.id,
			line,
		]),
	);
	const active = yield* Effect.forEach(
		runtime.jobs.filter((job) => job.ownerItemId === owner.id),
		(job) =>
			resolveActiveJobStatusFx({
				job,
				runtime,
			}).pipe(
				Effect.map((status) => {
					const line = lineById.get(job.lineId);
					const outputItemId = readPrimaryOutputItemId(line);
					return {
						jobId: job.id,
						lineId: job.lineId,
						title: line?.title ?? job.lineId,
						...(outputItemId === undefined
							? {}
							: {
									outputItemId,
								}),
						status,
						durationMs: job.durationMs,
						remainingMs: job.remainingMs,
					};
				}),
			),
	);
	const requests = (runtime.jobQueue ?? []).filter((request) => request.ownerItemId === owner.id);
	const projectedRequests = yield* Effect.forEach(requests, (request, index) =>
		Effect.gen(function* () {
			let status: ItemDetailQueueRequest["status"] =
				active.length > 0 || index > 0 ? "blocked-earlier" : "blocked-condition";
			let missingQuantity: number | undefined;
			if (
				active.length === 0 &&
				index === 0 &&
				owner.location.scope === LocationScopeEnumSchema.enum.Board
			) {
				const start = yield* resolveLineStartFx({
					ownerItemId: owner.id,
					lineId: request.lineId,
					runtime,
				});
				const nonMaterialInputsReady = start.run.input.every(
					({ resolution: input }) => input.type === "materials" || input.ready,
				);
				if (start.run.enable && nonMaterialInputsReady) {
					const hardConditions = yield* Effect.result(
						assertLineEnqueueConditionsFx({
							candidateId: request.id,
							resolution: start,
							runtime,
						}),
					);
					if (Result.isFailure(hardConditions)) {
						status = "blocked-condition";
						const line = lineById.get(request.lineId);
						const outputItemId = readPrimaryOutputItemId(line);
						return {
							requestId: request.id,
							lineId: request.lineId,
							title: line?.title ?? request.lineId,
							...(outputItemId === undefined
								? {}
								: {
										outputItemId,
									}),
							status,
						} satisfies ItemDetailQueueRequest;
					}
					const coverage = yield* readLineInputAutofillCoverageFx({
						ownerItemId: owner.id,
						lineId: request.lineId,
						runtime,
					});
					if (coverage.type === "incomplete" || coverage.plan.entry.length > 0) {
						status = "waiting-inputs";
						missingQuantity =
							coverage.selectedQuantity +
							(coverage.type === "incomplete" ? coverage.missingQuantity : 0);
					} else {
						const candidate = yield* resolveLineStartFx({
							ownerItemId: owner.id,
							lineId: request.lineId,
							runtime,
						});
						const output = yield* Effect.result(
							assertLineOutputMaxCountFx({
								candidateId: request.id,
								ownerItemId: owner.id,
								lineId: request.lineId,
								plan: candidate.run.plan,
								runtime,
							}),
						);
						status =
							candidate.run.ready && Result.isSuccess(output)
								? "inputs-ready"
								: "blocked-condition";
					}
				}
			}
			const line = lineById.get(request.lineId);
			const outputItemId = readPrimaryOutputItemId(line);
			return {
				requestId: request.id,
				lineId: request.lineId,
				title: line?.title ?? request.lineId,
				...(outputItemId === undefined
					? {}
					: {
							outputItemId,
						}),
				status,
				...(missingQuantity === undefined
					? {}
					: {
							missingQuantity,
						}),
			} satisfies ItemDetailQueueRequest;
		}),
	);
	return {
		kind: "available",
		itemId: owner.id,
		capacity,
		active,
		request: projectedRequests,
	} satisfies readItemDetailQueueFx.Result;
});
