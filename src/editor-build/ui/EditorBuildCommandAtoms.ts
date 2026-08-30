import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { installBuiltEditorArkpackFx } from "~/editor-build/renderer/installBuiltEditorArkpackFx";
import { saveEditorBuildFx } from "~/editor-build/renderer/saveEditorBuildFx";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import {
	EditorBuildRepository,
	type EditorBuildRepositoryService,
} from "~/editor-build/service/EditorBuildRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

type EditorBuildRequest = Omit<
	Parameters<EditorBuildRepositoryService["buildProjectFx"]>[0],
	"projectId"
>;

/** Keeps build command settlement keyed to the exact project or artifact identity it mutates. */
export const EditorBuildCommandAtoms = RendererRuntime.runSync(
	Effect.map(EditorBuildRepository, (repository) => ({
		build: Atom.family((projectId: string) =>
			Atom.fn((request: EditorBuildRequest) =>
				repository.buildProjectFx({
					...request,
					projectId,
				}),
			).pipe(Atom.setIdleTTL(0)),
		),
		install: Atom.family((contentHash: string) =>
			Atom.fn(
				(
					request: {
						readonly artifact: EditorProjectBuildSchema.Type;
						readonly confirmation?: EditorBuildMajorUpdateConfirmation;
						readonly targetVersion: ArkpackVersionSchema.Type;
					},
					get,
				) => {
					const { artifact } = request;
					if (artifact.contentHash !== contentHash)
						return Effect.fail(
							new Error("The selected editor build artifact is stale."),
						);
					const catalog = get(ArkpackCatalogOwnerAtom);
					if (catalog === undefined)
						return Effect.fail(new Error("Arkpack catalog is not configured."));
					return installBuiltEditorArkpackFx({
						...request,
						catalog,
						repository,
					});
				},
			).pipe(Atom.setIdleTTL(0)),
		),
		save: Atom.family((contentHash: string) =>
			Atom.fn((artifact: EditorProjectBuildSchema.Type) =>
				artifact.contentHash !== contentHash
					? Effect.fail(new Error("The selected editor build artifact is stale."))
					: saveEditorBuildFx(artifact),
			).pipe(Atom.setIdleTTL(0)),
		),
	})),
);
