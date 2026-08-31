import { Effect } from "effect";

import type { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { ItemJobScopedError } from "~/game-runtime/error/ItemJobScopedError";
import type { ItemStatefulError } from "~/game-runtime/error/ItemStatefulError";
import type { RuntimeInvalidError } from "~/game-runtime/error/RuntimeInvalidError";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import type { PlacementPlanInvalidError } from "~/item-placement/error/PlacementPlanInvalidError";
import type { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { BoardQueryOriginUnavailableError } from "~/item-query/error/BoardQueryOriginUnavailableError";
import type { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import type { InputRunPlanInvalidError } from "~/production-input/error/InputRunPlanInvalidError";
import type { JobNotFoundError } from "~/production-job/error/JobNotFoundError";
import type { JobNotReadyError } from "~/production-job/error/JobNotReadyError";
import type { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import type { JobQueueFullError } from "~/production-job/error/JobQueueFullError";
import type { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { replayRuntimeStepsFx } from "~/game-tick/fx/replayRuntimeStepsFx";

interface AdvanceRuntimeElapsedProps {
	readonly elapsedMs: number;
}

export interface AdvanceRuntimeElapsedResult {
	/**
	 * Exact runtime reference proven to remain unchanged by another fixed step.
	 * A later authoritative command replaces the reference and invalidates the proof.
	 */
	readonly stableRuntime: RuntimeSchema.Type | null;
}

export type AdvanceRuntimeElapsedError =
	| RuntimeInvalidError
	| ItemNotFoundError
	| ItemNotOnBoardError
	| ItemNotOnGridError
	| ItemStatefulError
	| PlacementPlanInvalidError
	| PlacementUnavailableError
	| LineNotFoundError
	| ItemJobScopedError
	| JobOwnerBusyError
	| JobQueueFullError
	| BoardQueryOriginUnavailableError
	| InputRunPlanInvalidError
	| JobNotFoundError
	| JobNotReadyError;

/** Replays one whole fixed-step elapsed budget inside one runtime transaction. */
export const advanceRuntimeElapsedFx: (
	props: AdvanceRuntimeElapsedProps,
) => Effect.Effect<
	AdvanceRuntimeElapsedResult,
	AdvanceRuntimeElapsedError,
	RuntimeStoreFx | GameConfigFx
> = Effect.fn("advanceRuntimeElapsedFx")(function* ({ elapsedMs }: AdvanceRuntimeElapsedProps) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const replay = yield* replayRuntimeStepsFx({
				elapsedMs,
				runtime,
			});
			return [
				{
					stableRuntime: replay.isStable ? replay.runtime : null,
				} satisfies AdvanceRuntimeElapsedResult,
				replay.runtime,
				replay.events,
			] as const;
		}),
	);
});
