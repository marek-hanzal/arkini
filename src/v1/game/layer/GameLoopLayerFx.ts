import { Duration, Effect, Layer, Schedule } from "effect";

import { TickFx } from "~/v1/tick/context/TickFx";
import { pulseTickFx } from "~/v1/tick/fx/pulseTickFx";
import { runTickRuntimeFx } from "~/v1/tick/fx/runTickRuntimeFx";

export namespace GameLoopLayerFx {
	export interface Props {
		intervalMs?: number;
		onTickError?: (cause: unknown) => void;
	}
}

const defaultOnTickError = (cause: unknown) => {
	console.error("Arkini tick failed; the committed runtime was preserved.", cause);
};

/** Starts one scoped production tick fiber for the lifetime of a game session. */
export const GameLoopLayerFx = ({
	intervalMs = 200,
	onTickError = defaultOnTickError,
}: GameLoopLayerFx.Props = {}) => {
	const pulse = Effect.gen(function* () {
		const tickService = yield* TickFx;
		const previous = yield* tickService.read;
		yield* pulseTickFx();
		yield* runTickRuntimeFx().pipe(
			Effect.catchAllCause((cause) =>
				tickService
					.set(previous)
					.pipe(Effect.zipRight(Effect.sync(() => onTickError(cause)))),
			),
		);
	});

	return Layer.scopedDiscard(
		pulse.pipe(
			Effect.repeat(Schedule.spaced(Duration.millis(Math.max(1, intervalMs)))),
			Effect.forkScoped,
		),
	);
};
