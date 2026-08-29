import { Effect, Layer } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { fromStateFx } from "~/game-persistence/fromStateFx";
import type { StateSchema } from "~/game-persistence/StateSchema";
import { TickLayerFx } from "~/game-tick/TickLayerFx";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { GameRuntimeLayerFx } from "~/game-runtime/layer/GameRuntimeLayerFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace GameLayerFx {
	export interface Props {
		config: GameConfigSchema.Type;
		state?: StateSchema.Type;
	}
}

/** Test-only composition of canonical Runtime and deterministic Tick without a live loop. */
export const GameLayerFx = ({ config, state }: GameLayerFx.Props) => {
	const makeGameLayer = (initialRuntime?: RuntimeSchema.Type) => {
		const runtime = GameRuntimeLayerFx({
			config,
			initialRuntime,
		});
		const tick = TickLayerFx.pipe(Layer.provide(runtime));
		return Layer.merge(runtime, tick);
	};

	if (state === undefined) return makeGameLayer();
	return Layer.unwrap(
		fromStateFx({
			state,
		}).pipe(Effect.provideService(GameConfigFx, config), Effect.map(makeGameLayer)),
	);
};
