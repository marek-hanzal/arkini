import { scheduleTask } from "@effect/atom-react";
import { Effect, Layer, ManagedRuntime } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/project-authoring/service/EditorProjectRepository";
import {
	EditorBuildRepository,
	type EditorBuildRepositoryService,
} from "~/editor-build/service/EditorBuildRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/project-authoring/error/EditorProjectRepositoryError";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { EditorUnsavedChangesOwnerAtom } from "~/authoring-session/atom/EditorUnsavedChangesOwnerAtom";
import { createEditorUnsavedChangesOwnerFx } from "~/authoring-session/fx/createEditorUnsavedChangesOwnerFx";
import * as Atom from "effect/unstable/reactivity/Atom";
import { GameEngineResourceLayer } from "~/installed-game/layer/GameEngineResourceLayer";
import type { InstalledGameEngineResource } from "~/installed-game/type/Game";
import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

export interface TestRendererRuntimeProps {
	readonly clearSaveFx?: Parameters<typeof GameEngineResourceLayer>[0]["clearSaveFx"];
	readonly createResourceFx: (
		packageId: string,
	) => Effect.Effect<InstalledGameEngineResource, unknown>;
	readonly editorBuildRepository?: EditorBuildRepositoryService;
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
	...UnusedEditorProjectRepository,
	awaitIdleFx: Effect.void,
	createProjectFx: () => unavailableEditorProjectRepositoryFx("create-project"),
	listProjectsFx: unavailableEditorProjectRepositoryFx("list-projects"),
	readProjectFx: () => unavailableEditorProjectRepositoryFx("read-project"),
	replaceConfigFx: () => unavailableEditorProjectRepositoryFx("replace-config"),
	replaceResourceFx: () => unavailableEditorProjectRepositoryFx("replace-resource"),
	deleteItemFx: () => unavailableEditorProjectRepositoryFx("delete-item"),
	upsertItemFx: () => unavailableEditorProjectRepositoryFx("upsert-item"),
	upsertResourcesFx: () => unavailableEditorProjectRepositoryFx("upsert-resource"),
};

const UnavailableEditorBuildRepository: EditorBuildRepositoryService = {
	buildProjectFx: () => Effect.die("This test did not provide an Editor Build repository."),
	readProjectBuildFx: () => Effect.die("This test did not provide an Editor Build repository."),
};

/** Creates one isolated renderer runtime with fresh Atom and Game lifecycle authorities. */
export const createTestRendererRuntime = ({
	clearSaveFx = () => Effect.void,
	createResourceFx,
	editorBuildRepository = UnavailableEditorBuildRepository,
	editorProjectRepository = UnavailableEditorProjectRepository,
}: TestRendererRuntimeProps) => {
	const atomRegistry = AtomRegistry.make({
		scheduleTask,
	});
	const rendererRuntime = ManagedRuntime.make(
		Layer.mergeAll(
			Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry),
			Layer.succeed(EditorBuildRepository, editorBuildRepository),
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
			Effect.gen(function* () {
				const service = yield* GameEngineResourceFx;
				const lease = yield* service.acquireLeaseFx({
					packageId,
				});
				return yield* service.adoptLeaseFx(lease);
			}),
		),
);
