import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { saveBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";

/** Reads and downloads the exact current canonical build and optional signature. */
export const saveBuiltEditorArkpackCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((contentHash: string) =>
			Atom.fn((artifact: EditorProjectBuildSchema.Type) =>
				artifact.contentHash !== contentHash
					? Effect.fail(new Error("The selected editor build artifact is stale."))
					: repository
							.readProjectBuildFx({
								projectId: artifact.projectId,
								expectedRevision: artifact.revision,
								contentHash: artifact.contentHash,
								...(artifact.signatureFilename === undefined
									? {}
									: {
											signatureFilename: artifact.signatureFilename,
										}),
							})
							.pipe(
								Effect.flatMap((content) =>
									saveBuiltEditorArkpackFx({
										artifact,
										content,
									}),
								),
							),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
