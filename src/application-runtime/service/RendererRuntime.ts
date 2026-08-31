import { Effect, Layer, ManagedRuntime } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import { acquireGameEngineResourceFx } from "~/installed-game/fx/acquireGameEngineResourceFx";
import { createGameFx } from "~/installed-game/fx/createGameFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorBuildRepository } from "~/editor-build/service/EditorBuildRepository";
import { createElectronEditorBuildRepositoryFx } from "~/editor-build/fx/createElectronEditorBuildRepositoryFx";
import { createElectronProjectRepositoryFx } from "~/project-authoring/fx/createElectronProjectRepositoryFx";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import { createEditorBoardGameResourceFx } from "~/board-scenario/fx/createEditorBoardGameResourceFx";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { EditorUnsavedChangesOwnerAtom } from "~/authoring-session/atom/EditorUnsavedChangesOwnerAtom";
import { createEditorUnsavedChangesOwnerFx } from "~/authoring-session/fx/createEditorUnsavedChangesOwnerFx";
import { GameEngineResourceLayer } from "~/installed-game/layer/GameEngineResourceLayer";
import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import { createElectronGameSaveStorageFx } from "~/game-persistence/fx/createElectronGameSaveStorageFx";

const RendererAtomRegistryLayer = Layer.succeed(AtomRegistry.AtomRegistry, RendererAtomRegistry);

const EditorUnsavedChangesLayer = Layer.effect(
	EditorUnsavedChanges,
	Effect.acquireRelease(
		createEditorUnsavedChangesOwnerFx().pipe(
			Effect.tap((owner) => Atom.set(EditorUnsavedChangesOwnerAtom, owner)),
		),
		() => Atom.set(EditorUnsavedChangesOwnerAtom, undefined),
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
	| ProjectRepository
	| EditorUnsavedChanges
	| GameEngineResourceFx,
	never
> = ManagedRuntime.make(
	Layer.mergeAll(
		RendererAtomRegistryLayer,
		Layer.effect(EditorBuildRepository, createElectronEditorBuildRepositoryFx),
		Layer.effect(ProjectRepository, createElectronProjectRepositoryFx),
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
