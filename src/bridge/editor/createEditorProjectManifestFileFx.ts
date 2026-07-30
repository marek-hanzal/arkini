import { Effect } from "effect";
import {
	EditorProjectManifestSchema,
} from "../../../electron/contract/editor/EditorProjectManifest";

import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

export namespace createEditorProjectManifestFileFx {
	export interface Props {
		readonly projectId: string;
		readonly title: string;
		readonly game?: string;
		readonly nowMs?: number;
	}
}

/** Creates the canonical editor.json marker for one new editor workspace. */
export const createEditorProjectManifestFileFx = Effect.fn(
	"createEditorProjectManifestFileFx",
)(function* ({
	projectId,
	title,
	game,
	nowMs = Date.now(),
}: createEditorProjectManifestFileFx.Props) {
	const manifest = yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.parse({
				projectId,
				title,
				...(game === undefined ? {} : { game }),
				createdAtMs: nowMs,
				updatedAtMs: nowMs,
			}),
		catch: (cause) => cause,
	});
	return {
		descriptor: {
			projectId: manifest.projectId,
			title: manifest.title,
			...(manifest.game === undefined ? {} : { game: manifest.game }),
			createdAtMs: manifest.createdAtMs,
			updatedAtMs: manifest.updatedAtMs,
		} satisfies EditorProjectDescriptor,
		file: {
			path: "editor.json",
			bytes: new TextEncoder().encode(`${JSON.stringify(manifest, null, "\t")}\n`),
		},
	} as const;
});
