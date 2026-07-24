import { Effect, Layer, ManagedRuntime } from "effect";

import { acquireGameEngineResourceFx } from "~/bridge/game/acquireGameEngineResourceFx";
import { GameEngineResourceLayer } from "~/bridge/game/GameEngineResourceLayer";
import { RendererAtomRegistryLayer } from "~/bridge/reactivity/RendererAtomRegistry";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";

/**
 * One process-lifetime Effect root for renderer bridge and shell programs.
 *
 * TODO(#397): Move this process-owned root to stable runtime APIs without duplicating
 * the renderer registry or game-resource service authority.
 */
export const RendererRuntime = ManagedRuntime.make(
	Layer.mergeAll(
		RendererAtomRegistryLayer,
		GameEngineResourceLayer({
			clearSaveFx: Effect.fn("RendererRuntime.clearSaveFx")((key: GameSaveStorage.Key) =>
				deleteGameSaveFx({
					key,
				}),
			),
			createResourceFx: Effect.fn("RendererRuntime.createResourceFx")((packageId: string) =>
				acquireGameEngineResourceFx({
					packageId,
				}),
			),
		}),
	),
);
