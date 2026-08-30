import { Effect, Layer } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { assertRuntimeFx } from "~/game-runtime/check/assertRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { fromConfigFx } from "~/game-runtime/fx/fromConfigFx";
import { makeRuntimeStoreFx } from "~/game-runtime/internal/makeRuntimeStoreFx";
import { RuntimeStoreFx } from "~/game-runtime/internal/RuntimeStoreFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface GameRuntimeLayerProps {
	config: GameConfigSchema.Type;
	initialRuntime?: RuntimeSchema.Type;
}

/** Builds the one canonical runtime store and its read-only projections. */
export const GameRuntimeLayerFx = ({ config, initialRuntime }: GameRuntimeLayerProps) => {
	const configLayer = Layer.succeed(GameConfigFx, config);
	const runtimeStoreLayer = Layer.effect(
		RuntimeStoreFx,
		(initialRuntime === undefined
			? fromConfigFx()
			: assertRuntimeFx({
					runtime: initialRuntime,
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

	return Layer.mergeAll(
		configLayer,
		runtimeStoreLayer,
		runtimeReadLayer,
		committedTransitionsLayer,
	);
};
