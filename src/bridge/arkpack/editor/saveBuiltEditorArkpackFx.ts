import { Effect } from "effect";

import type { buildEditorProjectFx } from "~/bridge/arkpack/editor/buildEditorProjectFx";

/** Requests browser-style Save As for one exact immutable editor build artifact. */
export const saveBuiltEditorArkpackFx = Effect.fn("saveBuiltEditorArkpackFx")(
	(artifact: buildEditorProjectFx.Success) =>
		Effect.acquireUseRelease(
			Effect.try({
				try: () =>
					URL.createObjectURL(
						new Blob(
							[
								artifact.bytes.slice().buffer,
							],
							{
								type: "application/octet-stream",
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
							anchor.download = artifact.filename;
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
