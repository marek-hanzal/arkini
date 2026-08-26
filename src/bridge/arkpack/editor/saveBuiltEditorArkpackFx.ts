import { Effect } from "effect";

import type {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor/EditorProjectBuildSchema";

const downloadFx = Effect.fn("saveBuiltEditorArkpackFx.downloadFx")(
	(filename: string, bytes: Uint8Array, type: string) =>
		Effect.acquireUseRelease(
			Effect.try({
				try: () =>
					URL.createObjectURL(
						new Blob(
							[
								bytes.slice().buffer,
							],
							{
								type,
							},
						),
					),
				catch: (cause) => cause,
			}),
			(url) =>
				Effect.acquireUseRelease(
					Effect.try({
						try: () => {
							const anchor = document.createElement("a");
							anchor.href = url;
							anchor.download = filename;
							document.body.append(anchor);
							return anchor;
						},
						catch: (cause) => cause,
					}),
					(anchor) =>
						Effect.try({
							try: () => anchor.click(),
							catch: (cause) => cause,
						}),
					(anchor) => Effect.sync(() => anchor.remove()),
				),
			(url) => Effect.sync(() => URL.revokeObjectURL(url)),
		),
);

/** Downloads the exact Arkpack plus its detached signature when the build is signed. */
export const saveBuiltEditorArkpackFx = Effect.fn("saveBuiltEditorArkpackFx")(function* ({
	artifact,
	content,
}: {
	readonly artifact: EditorProjectBuildSchema.Type;
	readonly content: EditorProjectBuildContentSchema.Type;
}) {
	yield* downloadFx(artifact.filename, content.bytes, "application/octet-stream");
	if (content.signature !== undefined && artifact.signatureFilename !== undefined) {
		yield* downloadFx(
			artifact.signatureFilename,
			new TextEncoder().encode(`${JSON.stringify(content.signature, undefined, "\t")}\n`),
			"application/json",
		);
	}
});
