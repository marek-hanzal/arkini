import { expireItemRuntimeFx } from "~/item-expiry/fx/expireItemRuntimeFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { readItemPhysicalContextFx } from "~/item-location/fx/readItemPhysicalContextFx";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { selectClockLineFx } from "~/item-schedule/fx/selectClockLineFx";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { readLineInputAutofillCoverageFx } from "~/production-input/fx/readLineInputAutofillCoverageFx";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";

interface AttemptScheduledItemExpiryProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
	excludedSourceItemIds?: ReadonlySet<IdSchema.Type>;
}

type AttemptScheduledItemExpiryResult =
	| {
			type: "blocked";
			error: PlacementUnavailableError;
			runtime: RuntimeSchema.Type;
	  }
	| {
			type: "expired" | "queued";
			facts: readonly EngineFact[];
			runtime: RuntimeSchema.Type;
			claimedSourceItemIds: readonly IdSchema.Type[];
	  };

interface CompleteScheduledItemExpiryTransitionResult {
	readonly type: "expired" | "queued";
	readonly facts: readonly EngineFact[];
	readonly runtime: RuntimeSchema.Type;
	readonly claimedSourceItemIds?: readonly IdSchema.Type[];
}

/** Schedules one expiry line as ordinary work, or removes an owner with no eligible work. */
const completeScheduledItemExpiryTransitionFx = Effect.fn(
	"completeScheduledItemExpiryTransitionFx",
)(function* ({ itemId, runtime, excludedSourceItemIds }: AttemptScheduledItemExpiryProps) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined)
		return yield* Effect.die(new Error(`Scheduled item ${itemId} is missing.`));
	const schedule = readItemScheduleFn(item.item);
	if (schedule === undefined || item.schedule?.remainingDurationMs !== 0) {
		return yield* Effect.die(new Error(`Scheduled item ${item.id} is not ready to expire.`));
	}
	const context = yield* readItemPhysicalContextFx({
		item,
		runtime,
	});

	const selectedLine = yield* selectClockLineFx({
		item,
		runtime,
		role: LineClockModeEnumSchema.enum["clock-lifetime"],
		origin: context.origin,
	});
	const force = schedule.expiryMode === "kill-switch";
	// Material owned by another job cannot run its own Board job. Its expiry must
	// settle immediately so the parent job can abort before advancing again.
	if (item.location.scope !== "board") {
		const expiry = yield* expireItemRuntimeFx({
			removalMode: force ? "kill-switch" : undefined,
			item,
			origin: context.origin,
			outcome: selectedLine?.outcome,
			randomSeed: [
				"serakki:scheduled-expiry",
				"v1",
				item.id,
				item.item.uid,
			].join(":"),
			runtime,
		});
		const release = force
			? {
					runtime: expiry.runtime,
					events: [],
				}
			: yield* releaseOwnerInputsFx({
					owner: item,
					origin: context.origin,
					runtime: expiry.runtime,
				});
		return {
			type: "expired",
			facts: [
				...expiry.facts,
				...release.events,
			],
			runtime: release.runtime,
		} satisfies CompleteScheduledItemExpiryTransitionResult;
	}
	let draft: RuntimeSchema.Type = {
		...runtime,
		jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== item.id),
	};
	const cancelledFacts: EngineFact[] = [];
	if (force) {
		for (const job of runtime.jobs.filter((candidate) => candidate.ownerItemId === item.id)) {
			if (!draft.jobs.some((candidate) => candidate.id === job.id)) continue;
			const aborted = yield* abortJobRuntimeFx({
				jobId: job.id,
				reason: "owner-removed",
				overflow: "discard",
				runtime: draft,
			});
			draft = aborted.runtime;
			cancelledFacts.push(...aborted.facts);
		}
	}
	const currentOwner = draft.items.find((candidate) => candidate.id === item.id);
	if (currentOwner === undefined)
		return {
			type: "expired",
			facts: cancelledFacts,
			runtime: draft,
		} satisfies CompleteScheduledItemExpiryTransitionResult;
	if (selectedLine !== undefined) {
		const queued = yield* Effect.gen(function* () {
			const coverage = yield* readLineInputAutofillCoverageFx({
				ownerItemId: item.id,
				lineUid: selectedLine.uid,
				runtime: draft,
				excludedSourceItemIds,
			});
			if (coverage.type === "incomplete") return undefined;
			const request = yield* enqueueLineRuntimeFx({
				ownerItemId: item.id,
				lineUid: selectedLine.uid,
				runtime: draft,
				allowTerminalLine: true,
			});
			return {
				request,
				claimedSourceItemIds: coverage.plan.entry.map((entry) => entry.sourceItemId),
			};
		}).pipe(
			Effect.catchTags({
				JobQueueFullError: () => Effect.succeed(undefined),
				LineRunUnavailableError: () => Effect.succeed(undefined),
				ItemNotOnBoardError: () => Effect.succeed(undefined),
			}),
		);
		if (queued !== undefined)
			return {
				type: "queued",
				facts: [
					...cancelledFacts,
					...queued.request.events,
				],
				runtime: queued.request.runtime,
				claimedSourceItemIds: queued.claimedSourceItemIds,
			} satisfies CompleteScheduledItemExpiryTransitionResult;
	}
	const expiry = yield* expireItemRuntimeFx({
		removalMode: force ? "kill-switch" : undefined,
		item: currentOwner,
		origin: context.origin,
		randomSeed: [
			"serakki:scheduled-expiry",
			"v1",
			item.id,
			item.item.uid,
		].join(":"),
		runtime: draft,
	});
	const release = force
		? {
				runtime: expiry.runtime,
				events: [],
			}
		: yield* releaseOwnerInputsFx({
				owner: item,
				origin: context.origin,
				runtime: expiry.runtime,
			});

	return {
		type: "expired",
		facts: [
			...cancelledFacts,
			...expiry.facts,
			...release.events,
		],
		runtime: release.runtime,
	} satisfies CompleteScheduledItemExpiryTransitionResult;
});

/** Resolves one ready scheduled expiry and keeps only expected delivery failures local. */
export const attemptScheduledItemExpiryFx = Effect.fn("attemptScheduledItemExpiryFx")(function* ({
	itemId,
	runtime,
	excludedSourceItemIds,
}: AttemptScheduledItemExpiryProps) {
	return yield* completeScheduledItemExpiryTransitionFx({
		itemId,
		runtime,
		excludedSourceItemIds,
	}).pipe(
		Effect.map(
			(completion) =>
				({
					type: completion.type,
					facts: completion.facts,
					runtime: completion.runtime,
					claimedSourceItemIds: completion.claimedSourceItemIds ?? [],
				}) satisfies AttemptScheduledItemExpiryResult,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies AttemptScheduledItemExpiryResult),
		),
	);
});
