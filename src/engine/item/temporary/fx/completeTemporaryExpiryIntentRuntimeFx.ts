import { Effect, Result } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { attemptTemporaryItemExpiryFx } from "~/engine/item/temporary/fx/attemptTemporaryItemExpiryFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeTimePolicyFx } from "~/engine/tick/context/RuntimeTimePolicyFx";

export namespace completeTemporaryExpiryIntentRuntimeFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Attempt {
		readonly failureTag: string;
		readonly itemRuntimeId: IdSchema.Type;
	}

	export type Result =
		| {
				readonly attempt: readonly Attempt[];
				readonly itemAvailable: boolean;
				readonly type: "blocked";
		  }
		| {
				readonly elapsedMs: number;
				readonly events: readonly GameEventSchema.Type[];
				readonly itemRuntimeId: IdSchema.Type;
				readonly runtime: RuntimeSchema.Type;
				readonly type: "completed";
		  }
		| {
				readonly reason: "timed-work-not-instant";
				readonly runtimeMs: number;
				readonly type: "unsupported";
		  };
}

const readFailureTag = (failure: unknown) =>
	typeof failure === "object" &&
	failure !== null &&
	"_tag" in failure &&
	typeof failure._tag === "string"
		? failure._tag
		: "UnknownEngineFailure";

const readRemainingDurationMs = (item: BoardRuntimeItemSchema.Type) =>
	item.remainingDurationMs ??
	(item.item.type === ItemEnumSchema.enum.Temporary
		? item.item.durationMs
		: Number.POSITIVE_INFINITY);

const compareCandidates = (left: BoardRuntimeItemSchema.Type, right: BoardRuntimeItemSchema.Type) =>
	readRemainingDurationMs(left) - readRemainingDurationMs(right) ||
	left.location.space - right.location.space ||
	left.location.position.y - right.location.position.y ||
	left.location.position.x - right.location.position.x ||
	left.id.localeCompare(right.id);

/** Expires one concrete temporary identity without advancing unrelated runtime clocks. */
export const completeTemporaryExpiryIntentRuntimeFx = Effect.fn(
	"completeTemporaryExpiryIntentRuntimeFx",
)(function* ({ itemId, runtime }: completeTemporaryExpiryIntentRuntimeFx.Props) {
	const candidates = runtime.items
		.filter(
			(candidate): candidate is BoardRuntimeItemSchema.Type =>
				candidate.item.id === itemId &&
				candidate.item.type === ItemEnumSchema.enum.Temporary &&
				candidate.location.scope === LocationScopeEnumSchema.enum.Board,
		)
		.slice()
		.sort(compareCandidates);
	const attempts: completeTemporaryExpiryIntentRuntimeFx.Attempt[] = [];
	const timePolicy = yield* RuntimeTimePolicyFx;

	for (const candidate of candidates) {
		const elapsedMs = readRemainingDurationMs(candidate);
		if (
			elapsedMs > 0 &&
			!(yield* timePolicy.completeTimedWorkInstantly({
				runtime,
			}))
		) {
			return {
				reason: "timed-work-not-instant",
				runtimeMs: elapsedMs,
				type: "unsupported",
			} satisfies completeTemporaryExpiryIntentRuntimeFx.Result;
		}

		const readyRuntime = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === candidate.id
					? {
							...item,
							remainingDurationMs: 0,
						}
					: item,
			),
		} satisfies RuntimeSchema.Type;
		const completion = yield* Effect.result(
			attemptTemporaryItemExpiryFx({
				itemId: candidate.id,
				runtime: readyRuntime,
			}),
		);
		if (Result.isFailure(completion)) {
			attempts.push({
				failureTag: readFailureTag(completion.failure),
				itemRuntimeId: candidate.id,
			});
			continue;
		}
		if (completion.success.type === "blocked") {
			attempts.push({
				failureTag: completion.success.error._tag,
				itemRuntimeId: candidate.id,
			});
			continue;
		}
		return {
			elapsedMs,
			events: completion.success.events,
			itemRuntimeId: candidate.id,
			runtime: completion.success.runtime,
			type: "completed",
		} satisfies completeTemporaryExpiryIntentRuntimeFx.Result;
	}

	return {
		attempt: attempts,
		itemAvailable: candidates.length > 0,
		type: "blocked",
	} satisfies completeTemporaryExpiryIntentRuntimeFx.Result;
});
