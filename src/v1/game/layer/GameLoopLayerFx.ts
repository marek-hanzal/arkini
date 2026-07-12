import { Duration, Effect, Fiber, Layer, Schedule } from "effect";

import { GameLoopFx } from "~/v1/game/context/GameLoopFx";
import { runTickRuntimeFx } from "~/v1/tick/fx/runTickRuntimeFx";

export namespace GameLoopLayerFx {
	export interface Props {
		intervalMs?: number;
		onTickError?: (cause: unknown) => void;
	}
}

const defaultOnTickError = (cause: unknown) => {
	console.error("Arkini tick failed; its elapsed budget remains pending.", cause);
};

/** Starts one scoped production tick fiber for the lifetime of a game session. */
export const GameLoopLayerFx = ({
	intervalMs = 200,
	onTickError = defaultOnTickError,
}: GameLoopLayerFx.Props = {}) => {
	const advance = runTickRuntimeFx().pipe(
		Effect.catchAllCause((cause) => Effect.sync(() => onTickError(cause))),
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
