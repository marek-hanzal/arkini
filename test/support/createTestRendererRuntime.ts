import { scheduleTask } from "@effect/atom-react";
import { Effect, Layer, ManagedRuntime } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/bridge/editor/EditorProjectRepositoryError";
import {
	EditorUnsavedChanges,
	EditorUnsavedChangesOwnerAtom,
} from "~/bridge/editor/EditorUnsavedChanges";
import { createEditorUnsavedChangesOwnerFx } from "~/bridge/editor/createEditorUnsavedChangesOwnerFx";
import * as Atom from "effect/unstable/reactivity/Atom";
import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { adoptGameEngineLeaseFx } from "~/bridge/game/adoptGameEngineLeaseFx";
import { GameEngineResourceLayer } from "~/bridge/game/GameEngineResourceLayer";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

export interface TestRendererRuntimeProps {
	readonly clearSaveFx?: Parameters<typeof GameEngineResourceLayer>[0]["clearSaveFx"];
	readonly createResourceFx: (packageId: string) => Effect.Effect<GameEngineResource, unknown>;
	readonly editorProjectRepository?: EditorProjectRepositoryService;
}

const unavailableEditorProjectRepositoryFx = (operation: EditorProjectRepositoryOperation) =>
	Effect.fail(
		new EditorProjectRepositoryError({
			operation,
			message: "This test did not provide an editor project repository.",
		}),
	);

/** Fail-fast default for tests which do not exercise editor persistence. */
const UnavailableEditorProjectRepository: EditorProjectRepositoryService = {
	awaitIdleFx: Effect.void,
	createProjectFx: () => unavailableEditorProjectRepositoryFx("create-project"),
	listProjectsFx: unavailableEditorProjectRepositoryFx("list-projects"),
	readProjectFx: () => unavailableEditorProjectRepositoryFx("read-project"),
	replaceConfigFx: () => unavailableEditorProjectRepositoryFx("replace-config"),
	replaceResourceFx: () => unavailableEditorProjectRepositoryFx("replace-resource"),
	upsertItemFx: () => unavailableEditorProjectRepositoryFx("upsert-item"),
	upsertResourcesFx: () => unavailableEditorProjectRepositoryFx("upsert-resource"),
};

/** Creates one isolated renderer runtime with fresh Atom and Game lifecycle authorities. */
export const createTestRendererRuntime = ({
	clearSaveFx = () => Effect.void,
	createResourceFx,
	editorProjectRepository = UnavailableEditorProjectRepository,
}: TestRendererRuntimeProps) => {
	const atomRegistry = AtomRegistry.make({
		scheduleTask,
	});
	const rendererRuntime = ManagedRuntime.make(
		Layer.mergeAll(
			Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry),
			Layer.succeed(EditorProjectRepository, editorProjectRepository),
			Layer.effect(
				EditorUnsavedChanges,
				createEditorUnsavedChangesOwnerFx().pipe(
					Effect.tap((owner) => Atom.set(EditorUnsavedChangesOwnerAtom, owner)),
				),
			).pipe(Layer.provide(Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry))),
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
