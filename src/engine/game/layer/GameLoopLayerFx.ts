import { Duration, Effect, Fiber, Layer, Schedule } from "effect";

import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";
import { GameLoopFx } from "~/engine/game/context/GameLoopFx";
import { runTickRuntimeFx } from "~/engine/tick/fx/runTickRuntimeFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";

export namespace GameLoopLayerFx {
	export interface Props {
		intervalMs?: number;
		onTickError?: (cause: unknown) => void | PromiseLike<void>;
	}
}

const defaultOnTickError = (cause: unknown) => {
	console.error("Arkini tick failed; its elapsed budget remains pending.", cause);
};

/** Starts one scoped production tick fiber for the lifetime of a game session. */
export const GameLoopLayerFx = ({
	intervalMs = TickStepMs,
	onTickError = defaultOnTickError,
}: GameLoopLayerFx.Props = {}) => {
	const advance = runTickRuntimeFx().pipe(
		Effect.catchAllCause((cause) =>
			invokeExternalCallbackFx({
				callback: onTickError,
				failureMessage: "Arkini tick error callback failed; the Tick loop remains active.",
				value: cause,
			}),
		),
	);

	return Layer.scoped(
		GameLoopFx,
		advance.pipe(
			Effect.repeat(Schedule.spaced(Duration.millis(Math.max(1, intervalMs)))),
			Effect.forkScoped,
			Effect.map((fiber) => ({
				stop: Fiber.interrupt(fiber).pipe(Effect.asVoid),
			})),
		),
	);
};
