import { Effect, Result } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { commitMergeItemsRuntimeFx } from "~/engine/merge/fx/commitMergeItemsRuntimeFx";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace mergeItemIntentRuntimeFx {
	export interface Props {
		readonly mergeIndex: number;
		readonly runtime: RuntimeSchema.Type;
		readonly sourceItemId: IdSchema.Type;
		readonly targetItemId: IdSchema.Type;
	}

	export interface Attempt {
		readonly failureTag: string;
		readonly sourceRuntimeItemId: IdSchema.Type;
		readonly targetRuntimeItemId: IdSchema.Type;
	}

	export type Result =
		| {
				readonly attempt: readonly Attempt[];
				readonly sourceAvailable: boolean;
				readonly targetAvailable: boolean;
				readonly type: "blocked";
		  }
		| {
				readonly events: readonly GameEventSchema.Type[];
				readonly runtime: RuntimeSchema.Type;
				readonly sourceRuntimeItemId: IdSchema.Type;
				readonly targetRuntimeItemId: IdSchema.Type;
				readonly type: "completed";
		  };
}

const readFailureTag = (failure: unknown) =>
	typeof failure === "object" &&
	failure !== null &&
	"_tag" in failure &&
	typeof failure._tag === "string"
		? failure._tag
		: "UnknownEngineFailure";

const readScopeRank = (item: GridRuntimeItemSchema.Type) => {
	if (item.location.scope === LocationScopeEnumSchema.enum.Board) return 0;
	if (item.location.scope === LocationScopeEnumSchema.enum.Toolbar) return 1;
	return 2;
};

const compareCandidates = (left: GridRuntimeItemSchema.Type, right: GridRuntimeItemSchema.Type) => {
	const leftCharges = left.remainingCharges ?? left.item.charges?.amount ?? -1;
	const rightCharges = right.remainingCharges ?? right.item.charges?.amount ?? -1;
	const leftDuration = left.remainingDurationMs ?? Number.POSITIVE_INFINITY;
	const rightDuration = right.remainingDurationMs ?? Number.POSITIVE_INFINITY;
	return (
		readScopeRank(left) - readScopeRank(right) ||
		rightCharges - leftCharges ||
		leftDuration - rightDuration ||
		right.quantity - left.quantity ||
		left.location.position.y - right.location.position.y ||
		left.location.position.x - right.location.position.x ||
		left.id.localeCompare(right.id)
	);
};

/** Resolves concrete identities and commits one canonical directional merge. */
export const mergeItemIntentRuntimeFx = Effect.fn("mergeItemIntentRuntimeFx")(function* ({
	mergeIndex,
	runtime,
	sourceItemId,
	targetItemId,
}: mergeItemIntentRuntimeFx.Props) {
	const sources = runtime.items
		.filter(
			(candidate): candidate is GridRuntimeItemSchema.Type =>
				candidate.item.id === sourceItemId &&
				((candidate.location.scope === LocationScopeEnumSchema.enum.Board &&
					candidate.location.space === runtime.currentSpace) ||
					candidate.location.scope === LocationScopeEnumSchema.enum.Inventory ||
					candidate.location.scope === LocationScopeEnumSchema.enum.Toolbar),
		)
		.slice()
		.sort(compareCandidates);
	const targets = runtime.items
		.filter(
			(candidate): candidate is GridRuntimeItemSchema.Type =>
				candidate.item.id === targetItemId &&
				candidate.location.scope === LocationScopeEnumSchema.enum.Board &&
				candidate.location.space === runtime.currentSpace,
		)
		.slice()
		.sort(compareCandidates);
	const attempts: mergeItemIntentRuntimeFx.Attempt[] = [];

	for (const source of sources) {
		for (const target of targets) {
			const resolved = yield* Effect.result(
				resolveMergeRuleFx({
					source,
					target,
				}),
			);
			if (Result.isFailure(resolved)) {
				attempts.push({
					failureTag: readFailureTag(resolved.failure),
					sourceRuntimeItemId: source.id,
					targetRuntimeItemId: target.id,
				});
				continue;
			}
			if (resolved.success.index !== mergeIndex) {
				attempts.push({
					failureTag: "MergeRulePrecedenceMismatch",
					sourceRuntimeItemId: source.id,
					targetRuntimeItemId: target.id,
				});
				continue;
			}
			const committed = yield* Effect.result(
				commitMergeItemsRuntimeFx({
					runtime,
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Effect.succeed(runtime),
					}),
				),
			);
			if (Result.isSuccess(committed)) {
				return {
					events: committed.success.events,
					runtime: committed.success.runtime,
					sourceRuntimeItemId: source.id,
					targetRuntimeItemId: target.id,
					type: "completed",
				} satisfies mergeItemIntentRuntimeFx.Result;
			}
			attempts.push({
				failureTag: readFailureTag(committed.failure),
				sourceRuntimeItemId: source.id,
				targetRuntimeItemId: target.id,
			});
		}
	}

	return {
		attempt: attempts,
		sourceAvailable: sources.length > 0,
		targetAvailable: targets.length > 0,
		type: "blocked",
	} satisfies mergeItemIntentRuntimeFx.Result;
});
