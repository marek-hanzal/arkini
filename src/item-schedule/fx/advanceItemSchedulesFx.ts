import { isInstantGameplayEnabledFn } from "~/game-runtime/fn/isInstantGameplayEnabledFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { Effect } from "effect";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

/** Advances boundary identities only; a pulse admits ordinary intent before closing its final lifetime. */
export const advanceItemSchedulesFx = Effect.fn("advanceItemSchedulesFx")(function* ({
	stepStart,
	runtime,
}: {
	readonly stepStart: RuntimeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const instantGameplay = isInstantGameplayEnabledFn({
		runtime,
	});
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	let dispatched = false;
	const owners = stepStart.items
		.filter((item) => item.schedule !== undefined)
		.sort((a, b) => a.id.localeCompare(b.id));
	for (const snapshot of owners) {
		const item = draft.items.find((candidate) => candidate.id === snapshot.id);
		const config = readItemScheduleFn(snapshot.item);
		const state = item?.schedule;
		if (
			item === undefined ||
			config === undefined ||
			state === undefined ||
			state.remainingDurationMs === 0 ||
			!(yield* resolveItemScheduleEnabledFx({
				item: snapshot,
				runtime: stepStart,
			}))
		)
			continue;
		const elapsed = Math.min(SimulationStepMs, state.remainingDurationMs ?? SimulationStepMs);
		const phase =
			state.remainingIntervalMs === undefined
				? undefined
				: item.location.scope === LocationScopeEnumSchema.enum.Board &&
						snapshot.location.scope === LocationScopeEnumSchema.enum.Board
					? state.remainingIntervalMs - elapsed
					: state.remainingIntervalMs;
		const expired =
			state.remainingDurationMs !== undefined &&
			(instantGameplay || state.remainingDurationMs <= elapsed);
		if (phase !== undefined && phase <= 0) {
			// Only expected admission rejection consumes the pulse without state, randomness or delivery side effects.
			const attempt = yield* Effect.gen(function* () {
				const line = readEffectiveLineFn({
					ownerItemId: item.id,
					ownerItem: item.item,
					runtime: draft,
					selection: "clock",
				});
				if (line === undefined) return undefined;
				return yield* enqueueLineRuntimeFx({
					ownerItemId: item.id,
					lineId: line.id,
					runtime: draft,
				});
			}).pipe(
				Effect.catchTags({
					JobQueueFullError: () => Effect.succeed(undefined),
					LineRunUnavailableError: () => Effect.succeed(undefined),
					OutputCapacityError: () => Effect.succeed(undefined),
					PlacementUnavailableError: () => Effect.succeed(undefined),
				}),
			);
			if (attempt !== undefined) {
				draft = attempt.runtime;
				events.push(...attempt.events);
			}
			dispatched = true;
		}
		draft = {
			...draft,
			items: draft.items.map((candidate) =>
				candidate.id !== item.id
					? candidate
					: {
							...candidate,
							schedule: {
								...state,
								remainingIntervalMs:
									phase !== undefined &&
									phase <= 0 &&
									config.intervalMs !== undefined
										? phase + config.intervalMs
										: phase,
								remainingDurationMs:
									state.remainingDurationMs === undefined
										? undefined
										: instantGameplay
											? 0
											: Math.max(0, state.remainingDurationMs - elapsed),
							},
						},
			),
		};
		dispatched ||= expired;
	}
	return {
		runtime: draft,
		events,
		dispatched,
	};
});
