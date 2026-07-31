import { Effect } from "effect";
import { EditorProjectManifestSchema } from "../../../electron/contract/editor/EditorProjectManifest";
import {
	EditorProjectRecordSchema,
	type EditorProjectRecord,
} from "../../../electron/contract/editor/EditorProjectRecord";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { createEditorProjectFromCompilationFx } from "~/bridge/editor/createEditorProjectFromCompilationFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { compileEditorProjectFilesFx } from "~/engine/editor/fx/compileEditorProjectFilesFx";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";

/** Compiles one exact persisted workspace record into the canonical renderer project. */
export const createEditorProjectFromRecordFx = Effect.fn(
	"createEditorProjectFromRecordFx",
)(function* (candidate: EditorProjectRecord) {
	const record = yield* Effect.try({
		try: () => EditorProjectRecordSchema.parse(candidate),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${candidate.projectId} returned an invalid workspace record.`,
				cause,
			}),
	});
	const manifestFile = record.files.find(({ path }) => path === "editor.json");
	if (manifestFile === undefined) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${record.projectId} does not contain editor.json.`,
			}),
		);
	}
	const manifest = yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.parse(
				JSON.parse(new TextDecoder().decode(manifestFile.bytes)) as unknown,
			),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${record.projectId} contains an invalid editor.json.`,
				cause,
			}),
	});
	if (manifest.projectId !== record.projectId) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${record.projectId} contains manifest ${manifest.projectId}.`,
			}),
		);
	}
	const descriptor = {
		projectId: manifest.projectId,
		title: manifest.title,
		...(manifest.game === undefined
			? {}
			: {
					game: manifest.game,
				}),
		createdAtMs: manifest.createdAtMs,
		updatedAtMs: manifest.updatedAtMs,
	} as const;
	const sourceRecords = record.files.filter(({ path }) => path !== "editor.json");
	if (!sourceRecords.some(({ path }) => path === "game.json")) {
		return {
			...descriptor,
			revision: record.revision,
			resources: [],
			resourceSourcePaths: {},
			diagnostics: [],
		} satisfies EditorProject;
	}
	const files = yield* Effect.try({
		try: () => EditorSourceFileSchema.array().parse(sourceRecords),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${record.projectId} contains an invalid file record.`,
				cause,
			}),
	});
	const compilation = yield* compileEditorProjectFilesFx(files);
	return yield* createEditorProjectFromCompilationFx({
		compilation,
		record,
		revision: record.revision,
	});
});
