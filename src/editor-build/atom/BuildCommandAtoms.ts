import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { installBuiltEditorArkpackFx } from "~/editor-build/fx/installBuiltEditorArkpackFx";
import { saveEditorBuildFx } from "~/editor-build/fx/saveEditorBuildFx";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import {
	EditorBuildRepository,
	type EditorBuildRepositoryService,
} from "~/editor-build/service/EditorBuildRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

type BuildRequest = Omit<
	Parameters<EditorBuildRepositoryService["buildProjectFx"]>[0],
	"projectId"
>;

/** Keeps project Build settlement across routed surfaces and artifact commands at exact identity. */
export const BuildCommandAtoms = RendererRuntime.runSync(
	Effect.map(EditorBuildRepository, (repository) => ({
		build: Atom.family((projectId: string) =>
			Atom.fn((request: BuildRequest) =>
				repository.buildProjectFx({
					...request,
					projectId,
				}),
			).pipe(Atom.keepAlive),
		),
		install: Atom.family((contentHash: string) =>
			Atom.fn(
				(
					request: {
						readonly artifact: EditorProjectBuildSchema.Type;
						readonly confirmation?: EditorBuildMajorUpdateConfirmation;
						readonly targetVersion: GameVersionSchema.Type;
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
