import { scheduleTask } from "@effect/atom-react";
import { Effect, Layer, ManagedRuntime } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { adoptGameEngineLeaseFx } from "~/bridge/game/adoptGameEngineLeaseFx";
import { GameEngineResourceLayer } from "~/bridge/game/GameEngineResourceLayer";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

export interface TestRendererRuntimeProps {
	readonly clearSaveFx?: Parameters<typeof GameEngineResourceLayer>[0]["clearSaveFx"];
	readonly createResourceFx: (packageId: string) => Effect.Effect<GameEngineResource, unknown>;
}

/** Creates one isolated renderer runtime with fresh Atom and Game lifecycle authorities. */
export const createTestRendererRuntime = ({
	clearSaveFx = () => Effect.void,
	createResourceFx,
}: TestRendererRuntimeProps) => {
	const atomRegistry = AtomRegistry.make({
		scheduleTask,
	});
	const rendererRuntime = ManagedRuntime.make(
		Layer.mergeAll(
			Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry),
			GameEngineResourceLayer({
				clearSaveFx,
				createResourceFx,
			}),
		),
	);
	return {
		atomRegistry,
		rendererRuntime,
	};
};

/** Creates and adopts one exact active Game through the public scoped service contract. */
export const adoptTestGameEngineResourceFx = Effect.fn("adoptTestGameEngineResourceFx")(
	(packageId: string) =>
		Effect.scoped(
			acquireGameEngineLeaseFx({
				packageId,
			}).pipe(Effect.flatMap(adoptGameEngineLeaseFx)),
		),
);
