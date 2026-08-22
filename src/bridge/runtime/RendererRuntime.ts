import { Effect, Layer, ManagedRuntime } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import { acquireGameEngineResourceFx } from "~/bridge/game/acquireGameEngineResourceFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorProjectRepositoryLayer } from "~/bridge/editor/EditorProjectRepositoryLayer";
import {
	EditorUnsavedChanges,
	EditorUnsavedChangesOwnerAtom,
} from "~/bridge/editor/EditorUnsavedChanges";
import { createEditorUnsavedChangesOwnerFx } from "~/bridge/editor/createEditorUnsavedChangesOwnerFx";
import { GameEngineResourceLayer } from "~/bridge/game/GameEngineResourceLayer";
import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";
import { RendererAtomRegistryLayer } from "~/bridge/reactivity/RendererAtomRegistry";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";

const EditorUnsavedChangesLayer = Layer.effect(
	EditorUnsavedChanges,
	createEditorUnsavedChangesOwnerFx().pipe(
		Effect.tap((owner) => Atom.set(EditorUnsavedChangesOwnerAtom, owner)),
	),
).pipe(Layer.provide(RendererAtomRegistryLayer));

/**
 * One process-lifetime Effect root for renderer bridge and shell programs.
 *
 * TODO(#397): Move this process-owned root to stable runtime APIs without duplicating
 * the renderer registry or game-resource service authority.
 */
export const RendererRuntime: ManagedRuntime.ManagedRuntime<
	| AtomRegistry.AtomRegistry
	| EditorProjectRepository
	| EditorUnsavedChanges
	| GameEngineResourceFx,
	never
> = ManagedRuntime.make(
	Layer.mergeAll(
		RendererAtomRegistryLayer,
		EditorProjectRepositoryLayer(),
		EditorUnsavedChangesLayer,
		GameEngineResourceLayer({
			clearSaveFx: Effect.fn("RendererRuntime.clearSaveFx")((key: GameSaveStorage.Key) =>
				deleteGameSaveFx({
					key,
				}),
			),
			createResourceFx: Effect.fn("RendererRuntime.createResourceFx")((packageId: string) =>
				acquireGameEngineResourceFx({
					createGameFx: (selectedPackageId) =>
						createGameFx({
							packageId: selectedPackageId,
							runRendererEffect: (effect) => RendererRuntime.runSync(effect),
						}),
					packageId,
				}),
			),
		}),
	),
);
