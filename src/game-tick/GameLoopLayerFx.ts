import { Cause, Duration, Effect, Fiber, Layer, Schedule } from "effect";

import { GameLoopFx } from "~/game-tick/GameLoopFx";
import { TickFx } from "~/game-tick/TickFx";
import { TickStepMs } from "~/game-tick/TickStepMs";

interface GameLoopLayerProps {
	readonly intervalMs?: number;
	readonly onFatalError?: (cause: unknown) => void;
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
}: GameLoopLayerProps = {}) => {
	const advance = TickFx.pipe(
		Effect.flatMap(({ advanceRuntime }) => advanceRuntime),
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
