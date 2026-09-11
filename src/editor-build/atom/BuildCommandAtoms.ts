import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { installBuiltEditorArkpackFx } from "~/editor-build/fx/installBuiltEditorArkpackFx";
import { saveEditorBuildFx } from "~/editor-build/fx/saveEditorBuildFx";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { EditorBuildRepository } from "~/editor-build/service/EditorBuildRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

interface BuildRequest {
	readonly expectedRevision: number;
	readonly version: VersionPartsSchema.Type;
}

/** Keeps project Build settlement across routed surfaces and artifact commands at exact identity. */
export const BuildCommandAtoms = RendererRuntime.runSync(
	Effect.map(EditorBuildRepository, (repository) => ({
		build: Atom.family((projectId: string) =>
			Atom.fn((request: BuildRequest) =>
				Effect.gen(function* () {
					// Remember output metadata even if compilation later fails, without publishing a Board revision.
					yield* Effect.uninterruptible(
						Effect.gen(function* () {
							const version = yield* repository.saveBuildVersionFx({
								...request,
								projectId,
							});
							const projectAtom = EditorProjectAtom(projectId);
							const project = yield* Atom.get(projectAtom);
							if (
								project !== undefined &&
								project.revision === request.expectedRevision
							)
								yield* Atom.set(projectAtom, {
									project: {
										...project,
										version,
									},
								});
						}),
					);
					return yield* repository.buildProjectFx({
						projectId,
						expectedRevision: request.expectedRevision,
						expectedVersion: request.version,
					});
				}),
			).pipe(Atom.keepAlive),
		),
		install: Atom.family((contentHash: string) =>
			Atom.fn(
				(
					request: {
						readonly artifact: EditorProjectBuildSchema.Type;
						readonly confirmation?: EditorBuildMajorUpdateConfirmation;
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
