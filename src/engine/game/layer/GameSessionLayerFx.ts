import { Effect, Layer } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { GameLoopLayerFx } from "~/game-tick/GameLoopLayerFx";
import { fromStateFx } from "~/engine/state/fx/fromStateFx";
import { TickLayerFx } from "~/game-tick/TickLayerFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { GameRuntimeLayerFx } from "~/game-runtime/layer/GameRuntimeLayerFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface GameSessionLayerProps {
	config: GameConfigSchema.Type;
	state?: StateSchema.Type;
	intervalMs?: number;
	onFatalError?: (cause: unknown) => void;
}

/** Combines one game core with its scoped production loop. */
export const GameSessionLayerFx = ({
	config,
	state,
	intervalMs,
	onFatalError,
}: GameSessionLayerProps) => {
	const makeSessionLayer = (initialRuntime?: RuntimeSchema.Type) => {
		const runtime = GameRuntimeLayerFx({
			config,
			initialRuntime,
		});
		const tick = TickLayerFx.pipe(Layer.provide(runtime));
		const core = Layer.merge(runtime, tick);
		const loop = GameLoopLayerFx({
			intervalMs,
			onFatalError,
		}).pipe(Layer.provide(core));
		return Layer.merge(core, loop);
	};

	if (state === undefined) return makeSessionLayer();
	return Layer.unwrap(
		fromStateFx({
			state,
		}).pipe(Effect.provideService(GameConfigFx, config), Effect.map(makeSessionLayer)),
	);
};
