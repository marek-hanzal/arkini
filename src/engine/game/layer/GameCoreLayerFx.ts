import { Effect, Layer } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import { fromConfigFx } from "~/engine/runtime/fx/fromConfigFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { makeRuntimeStoreFx } from "~/engine/runtime/internal/makeRuntimeStoreFx";
import { RuntimeStoreFx } from "~/engine/runtime/internal/RuntimeStoreFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { TickFx } from "~/engine/tick/context/TickFx";
import type { TickFxService } from "~/engine/tick/context/TickFx";
import { advanceRuntimeElapsedFx } from "~/engine/tick/internal/advanceRuntimeElapsedFx";
import { makeTickServiceFx } from "~/engine/tick/internal/makeTickServiceFx";

export namespace GameCoreLayerFx {
	export interface Props {
		config: GameConfigSchema.Type;
		state?: StateSchema.Type;
	}
}

const makeTickFx = Effect.fn("makeTickFx")(function* () {
	const service = yield* makeTickServiceFx({
		advanceRuntimeElapsed: advanceRuntimeElapsedFx,
	});
	return {
		read: service.read,
		advanceRuntime: service.advanceRuntime.pipe(Effect.asVoid),
		advanceRuntimeBy: (elapsedMs) => service.advanceRuntimeBy(elapsedMs).pipe(Effect.asVoid),
	} satisfies TickFxService;
});

/** Builds the stateful services owned by one loaded game without starting background work. */
export const GameCoreLayerFx = ({ config, state }: GameCoreLayerFx.Props) => {
	const configLayer = Layer.succeed(GameConfigFx, config);
	const runtimeStoreLayer = Layer.effect(
		RuntimeStoreFx,
		(state === undefined
			? fromConfigFx()
			: fromStateFx({
					state,
				})
		).pipe(
			Effect.map(
				(runtime): CommittedTransitionSchema.Type => ({
					sequence: 0,
					previousRuntime: null,
					runtime,
					events: [],
				}),
			),
			Effect.flatMap(makeRuntimeStoreFx),
			Effect.provide(configLayer),
		),
	);
	const runtimeReadLayer = Layer.effect(
		RuntimeFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				read: store.read.pipe(Effect.map((transition) => transition.runtime)),
			})),
		),
	).pipe(Layer.provide(runtimeStoreLayer));
	const committedTransitionsLayer = Layer.effect(
		CommittedTransitionsFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				changes: store.changes,
				read: store.read,
				readUnsafe: store.readUnsafe,
				ref: store.ref,
			})),
		),
	).pipe(Layer.provide(runtimeStoreLayer));
	const tickLayer = Layer.effect(TickFx, makeTickFx()).pipe(Layer.provide(runtimeReadLayer));

	return Layer.mergeAll(
		configLayer,
		runtimeStoreLayer,
		runtimeReadLayer,
		committedTransitionsLayer,
		tickLayer,
	);
};
