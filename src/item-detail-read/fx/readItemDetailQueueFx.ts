import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { Effect, Option, Result } from "effect";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { resolveActiveJobStatusFx } from "~/production-job/fx/resolveActiveJobStatusFx";
import type { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import { readItemQueueSizeFn } from "~/production-job/fn/readItemQueueSizeFn";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";
import { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { assertLineEnqueueConditionsFx } from "~/production-job/fx/assertLineEnqueueConditionsFx";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import { RuleTypeSchema } from "~/production-line/schema/RuleTypeSchema";

interface ItemDetailQueueRequest {
	readonly requestId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly title: string;
	readonly outputItemId?: IdSchema.Type;
	readonly status: "inputs-ready" | "waiting-inputs" | "blocked-active" | "blocked-condition";
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
				readonly used: number;
				readonly canClearQueue: boolean;
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

const readPrimaryOutputItemIdFn = (line: LineSchema.Type | undefined) => {
	const roll = line?.output?.set[0]?.roll[0];
	if (roll === undefined) return undefined;
	return roll.drop[0]?.itemId;
};

const readVisibleWorkLineIdsFx = Effect.fn("readVisibleWorkLineIdsFx")(function* ({
	lineOwner,
	owner,
	runtime,
	workLineIds,
}: {
	readonly lineOwner: ItemSchema.Type;
	readonly owner: RuntimeSchema.Type["items"][number];
	readonly runtime: RuntimeSchema.Type;
	readonly workLineIds: ReadonlySet<IdSchema.Type>;
}) {
	const visibleLineIds = new Set<IdSchema.Type>();
	for (const line of lineOwner.lines) {
		if (!workLineIds.has(line.id)) continue;
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			if (line.show) visibleLineIds.add(line.id);
			continue;
		}
		const visibilityRules = line.rules.filter(
			(rule) =>
				rule.type === RuleTypeSchema.enum.Show || rule.type === RuleTypeSchema.enum.Hide,
		);
		const rules = yield* lineRulesFx({
			origin: owner.location,
			rules: visibilityRules,
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
		);
		if (
			resolveLineShowFn({
				line,
				rules,
			})
		)
			visibleLineIds.add(line.id);
	}
	return visibleLineIds;
});

/** Projects active and queued line work for one exact line owner. */
export const readItemDetailQueueFx = Effect.fn("readItemDetailQueueFx")(function* ({
	itemId,
	runtime,
}: readItemDetailQueueFx.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner === undefined) return unavailable;
	const lineOwner = narrowLineOwnerItemFn(owner.item);
	if (Option.isNone(lineOwner)) return unavailable;
	const capacity = readItemQueueSizeFn({
		item: lineOwner.value,
	});
	if (capacity === undefined) return unavailable;
	const lineById = new Map(
		lineOwner.value.lines.map((line) => [
			line.id,
			line,
		]),
	);
	const allActive = runtime.jobs.filter((job) => job.ownerItemId === owner.id);
	const allRequests = runtime.jobQueue.filter((request) => request.ownerItemId === owner.id);
	const visibleWorkLineIds = yield* readVisibleWorkLineIdsFx({
		lineOwner: lineOwner.value,
		owner,
		runtime,
		workLineIds: new Set([
			...allActive.map((job) => job.lineId),
			...allRequests.map((request) => request.lineId),
		]),
	});
	const active = yield* Effect.forEach(
		allActive.filter((job) => visibleWorkLineIds.has(job.lineId)),
		(job) =>
			resolveActiveJobStatusFx({
				job,
				runtime,
			}).pipe(
				Effect.map((status) => {
					const line = lineById.get(job.lineId);
					const outputItemId = readPrimaryOutputItemIdFn(line);
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
	const requests = allRequests.filter((request) => visibleWorkLineIds.has(request.lineId));
	const projectedRequests = yield* Effect.forEach(requests, (request) =>
		Effect.gen(function* () {
			let status: ItemDetailQueueRequest["status"] =
				allActive.length > 0 ? "blocked-active" : "blocked-condition";
			let missingQuantity: number | undefined;
			if (
				allActive.length === 0 &&
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
					if (Result.isSuccess(hardConditions)) {
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
							// Each row reads the same snapshot; readiness does not predict dispatch order.
							status = start.run.ready ? "inputs-ready" : "blocked-condition";
						}
					}
				}
			}
			const line = lineById.get(request.lineId);
			const outputItemId = readPrimaryOutputItemIdFn(line);
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
		used: allActive.length + allRequests.length,
		canClearQueue: canControlItemProductionFn(owner.item),
		active,
		request: projectedRequests,
	} satisfies readItemDetailQueueFx.Result;
});
