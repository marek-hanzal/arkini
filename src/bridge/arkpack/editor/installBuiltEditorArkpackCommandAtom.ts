import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";

/** Reads and installs the exact current canonical build instead of caching artifact bytes. */
export const installBuiltEditorArkpackCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((contentHash: string) =>
			Atom.fn((artifact: EditorProjectBuildSchema.Type, get) => {
				if (artifact.contentHash !== contentHash)
					return Effect.fail(new Error("The selected editor build artifact is stale."));
				const catalog = get(ArkpackCatalogOwnerAtom);
				if (catalog === undefined)
					return Effect.fail(new Error("Arkpack catalog is not configured."));
				return repository
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
							catalog.installFx({
								bytes: content.bytes,
								filename: artifact.filename,
								...(content.signature === undefined
									? {}
									: {
											signature: content.signature,
										}),
							}),
						),
					);
			}).pipe(Atom.setIdleTTL(0)),
		),
	),
);
