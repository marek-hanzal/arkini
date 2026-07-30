import { Effect } from "effect";
import {
	EditorProjectManifestSchema,
} from "../../../electron/contract/editor/EditorProjectManifest";

import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

export namespace createEditorProjectManifestFileFx {
	export interface Props {
		readonly projectId: string;
		readonly title: string;
		readonly gameVersion?: string;
		readonly nowMs?: number;
	}
}

/** Creates the canonical editor.json marker for one new editor workspace. */
export const createEditorProjectManifestFileFx = Effect.fn(
	"createEditorProjectManifestFileFx",
)(function* ({
	projectId,
	title,
	gameVersion,
	nowMs = Date.now(),
}: createEditorProjectManifestFileFx.Props) {
	const manifest = yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.parse({
				formatVersion: 1,
				projectId,
				title,
				...(gameVersion === undefined ? {} : { gameVersion }),
				createdAtMs: nowMs,
				updatedAtMs: nowMs,
			}),
		catch: (cause) => cause,
	});
	return {
		descriptor: {
			projectId: manifest.projectId,
			title: manifest.title,
			...(manifest.gameVersion === undefined ? {} : { gameVersion: manifest.gameVersion }),
			createdAtMs: manifest.createdAtMs,
			updatedAtMs: manifest.updatedAtMs,
		} satisfies EditorProjectDescriptor,
		file: {
			path: "editor.json",
			bytes: new TextEncoder().encode(`${JSON.stringify(manifest, null, "\t")}\n`),
		},
	} as const;
});
