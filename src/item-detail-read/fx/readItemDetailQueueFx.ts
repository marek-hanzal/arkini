import { Effect, Option, Result } from "effect";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { resolveActiveJobStatusFx } from "~/production-job/fx/resolveActiveJobStatusFx";
import type { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
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
	readonly lineUid: IdSchema.Type;
	readonly status: "inputs-ready" | "waiting-inputs" | "blocked-active" | "blocked-condition";
}

interface ItemDetailQueueActiveJob {
	readonly jobId: IdSchema.Type;
	readonly lineUid: IdSchema.Type;
	readonly status: JobStatusEnumSchema.Type;
}

export namespace readItemDetailQueueFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
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

const readVisibleWorkLineUidsFx = Effect.fn("readVisibleWorkLineUidsFx")(function* ({
	lineOwner,
	owner,
	runtime,
	workLineUids,
}: {
	readonly lineOwner: ItemSchema.Type;
	readonly owner: RuntimeSchema.Type["items"][number];
	readonly runtime: RuntimeSchema.Type;
	readonly workLineUids: ReadonlySet<IdSchema.Type>;
}) {
	const visibleLineUids = new Set<IdSchema.Type>();
	for (const line of lineOwner.lines) {
		if (!workLineUids.has(line.uid)) continue;
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			if (line.show) visibleLineUids.add(line.uid);
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
			visibleLineUids.add(line.uid);
	}
	return visibleLineUids;
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
	const allActive = runtime.jobs.filter((job) => job.ownerItemId === owner.id);
	const allRequests = runtime.jobQueue.filter((request) => request.ownerItemId === owner.id);
	const visibleWorkLineUids = yield* readVisibleWorkLineUidsFx({
		lineOwner: lineOwner.value,
		owner,
		runtime,
		workLineUids: new Set([
			...allActive.map((job) => job.lineUid),
			...allRequests.map((request) => request.lineUid),
		]),
	});
	const active = yield* Effect.forEach(
		allActive.filter((job) => visibleWorkLineUids.has(job.lineUid)),
		(job) =>
			resolveActiveJobStatusFx({
				job,
				runtime,
			}).pipe(
				Effect.map((status) => ({
					jobId: job.id,
					lineUid: job.lineUid,
					status,
				})),
			),
	);
	const requests = allRequests.filter((request) => visibleWorkLineUids.has(request.lineUid));
	const projectedRequests = yield* Effect.forEach(requests, (request) =>
		Effect.gen(function* () {
			let status: ItemDetailQueueRequest["status"] =
				allActive.length > 0 ? "blocked-active" : "blocked-condition";
			if (
				allActive.length === 0 &&
				owner.location.scope === LocationScopeEnumSchema.enum.Board
			) {
				const start = yield* resolveLineStartFx({
					ownerItemId: owner.id,
					lineUid: request.lineUid,
					runtime,
				});
				const nonMaterialInputsReady = start.run.input.every(
					({ resolution: input }) => input.type === "materials" || input.ready,
				);
				if (start.run.enable && nonMaterialInputsReady) {
					const hardConditions = yield* Effect.result(
						assertLineEnqueueConditionsFx({
							resolution: start,
							runtime,
						}),
					);
					if (Result.isSuccess(hardConditions)) {
						const coverage = yield* readLineInputAutofillCoverageFx({
							ownerItemId: owner.id,
							lineUid: request.lineUid,
							runtime,
						});
						if (coverage.type === "incomplete" || coverage.plan.entry.length > 0) {
							status = "waiting-inputs";
						} else {
							// Each row reads the same snapshot; readiness does not predict dispatch order.
							status = start.run.ready ? "inputs-ready" : "blocked-condition";
						}
					}
				}
			}
			return {
				requestId: request.id,
				lineUid: request.lineUid,
				status,
			} satisfies ItemDetailQueueRequest;
		}),
	);
	return {
		kind: "available",
		active,
		request: projectedRequests,
	} satisfies readItemDetailQueueFx.Result;
});
