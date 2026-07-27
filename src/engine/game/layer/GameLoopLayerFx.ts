import { Cause, Duration, Effect, Fiber, Layer, Schedule } from "effect";

import { GameLoopFx } from "~/engine/game/context/GameLoopFx";
import { runTickRuntimeFx } from "~/engine/tick/fx/runTickRuntimeFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";

export namespace GameLoopLayerFx {
	export interface Props {
		intervalMs?: number;
		onFatalError?: (cause: unknown) => void;
	}
}

/**
 * Starts one scoped production Tick fiber for the lifetime of a game session.
 *
 * The periodic clock pulse remains authoritative while Tick skips stable runtime work.
 * An async runtime notification has no commit timestamp, so rebasing wall time when its
 * listener runs would silently move job completion boundaries under renderer load.
 */
export const GameLoopLayerFx = ({
	intervalMs = TickStepMs,
	onFatalError = () => undefined,
}: GameLoopLayerFx.Props = {}) => {
	const advance = runTickRuntimeFx().pipe(
		Effect.onError((cause) =>
			Cause.hasInterruptsOnly(cause) ? Effect.void : Effect.sync(() => onFatalError(cause)),
		),
	);

	return Layer.effect(
		GameLoopFx,
		advance.pipe(
			Effect.repeat(Schedule.spaced(Duration.millis(Math.max(1, intervalMs)))),
			Effect.forkScoped({
				startImmediately: true,
			}),
			Effect.map((fiber) => ({
				stop: Fiber.interrupt(fiber).pipe(Effect.asVoid),
			})),
		),
	);
};
