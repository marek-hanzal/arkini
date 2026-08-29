import { Effect, Layer, ManagedRuntime } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import { acquireGameEngineResourceFx } from "~/renderer/game/resource/acquireGameEngineResourceFx";
import { createGameFx } from "~/renderer/game/createGameFx";
import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorBuildRepository } from "~/editor-build/domain/EditorBuildRepository";
import { createElectronEditorBuildRepositoryFx } from "~/editor-build/renderer/createElectronEditorBuildRepositoryFx";
import { createElectronEditorProjectRepositoryFx } from "~/project-authoring/repository/createElectronEditorProjectRepositoryFx";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/session/EditorBoardGameResourceOwnerAtom";
import { createEditorBoardGameResourceFx } from "~/board-scenario/session/createEditorBoardGameResourceFx";
import { EditorUnsavedChanges } from "~/renderer/editor/unsaved/EditorUnsavedChanges";
import { EditorUnsavedChangesOwnerAtom } from "~/renderer/editor/unsaved/EditorUnsavedChangesOwnerAtom";
import { createEditorUnsavedChangesOwnerFx } from "~/renderer/editor/unsaved/createEditorUnsavedChangesOwnerFx";
import { GameEngineResourceLayer } from "~/renderer/game/resource/GameEngineResourceLayer";
import { GameEngineResourceFx } from "~/renderer/game/resource/GameEngineResourceFx";
import { RendererAtomRegistryLayer } from "~/renderer/RendererAtomRegistry";
import type { GameSaveStorage } from "~/engine/save/GameSaveStorage";
import { createElectronGameSaveStorageFx } from "~/renderer/save/createElectronGameSaveStorageFx";

const EditorUnsavedChangesLayer = Layer.effect(
	EditorUnsavedChanges,
	createEditorUnsavedChangesOwnerFx().pipe(
		Effect.tap((owner) => Atom.set(EditorUnsavedChangesOwnerAtom, owner)),
	),
).pipe(Layer.provide(RendererAtomRegistryLayer));

const EditorBoardGameLayer = Layer.effectDiscard(
	Effect.acquireRelease(
		createEditorBoardGameResourceFx().pipe(
			Effect.tap((owner) => Atom.set(EditorBoardGameResourceOwnerAtom, owner)),
		),
		(owner) =>
			owner.shutdownFx.pipe(
				Effect.ensuring(Atom.set(EditorBoardGameResourceOwnerAtom, undefined)),
			),
	),
).pipe(Layer.provide(RendererAtomRegistryLayer));

/**
 * One process-lifetime Effect root for renderer-process capabilities and shell programs.
 *
 * TODO(#397): Move this process-owned root to stable runtime APIs without duplicating
 * the renderer registry or game-resource service authority.
 */
export const RendererRuntime: ManagedRuntime.ManagedRuntime<
	| AtomRegistry.AtomRegistry
	| EditorBuildRepository
	| EditorProjectRepository
	| EditorUnsavedChanges
	| GameEngineResourceFx,
	never
> = ManagedRuntime.make(
	Layer.mergeAll(
		RendererAtomRegistryLayer,
		Layer.effect(EditorBuildRepository, createElectronEditorBuildRepositoryFx),
		Layer.effect(EditorProjectRepository, createElectronEditorProjectRepositoryFx),
		EditorBoardGameLayer,
		EditorUnsavedChangesLayer,
		GameEngineResourceLayer({
			clearSaveFx: Effect.fn("RendererRuntime.clearSaveFx")((key: GameSaveStorage.Key) =>
				createElectronGameSaveStorageFx().pipe(
					Effect.flatMap((storage) => storage.clearFx(key)),
				),
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
