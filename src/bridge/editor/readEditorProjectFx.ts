import { Effect } from "effect";
import { EditorProjectManifestSchema } from "../../../electron/contract/editor/EditorProjectManifest";
import { EditorProjectRecordSchema } from "../../../electron/contract/editor/EditorProjectRecord";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { compileEditorProjectFilesFx } from "~/engine/editor/fx/compileEditorProjectFilesFx";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";

export namespace readEditorProjectFx {
	export interface Props {
		readonly projectId: string;
		readonly workspace?: EditorWorkspace;
	}
}

/** Reads one manifest-backed project and compiles game sources when they exist. */
export const readEditorProjectFx = Effect.fn("readEditorProjectFx")(function* ({
	projectId,
	workspace: providedWorkspace,
}: readEditorProjectFx.Props) {
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	const record = yield* workspace.readFx(projectId);
	if (record === null) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "project-not-found",
				message: `Editor project ${projectId} does not exist.`,
			}),
		);
	}
	const parsedRecord = yield* Effect.try({
		try: () => EditorProjectRecordSchema.parse(record),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} returned an invalid workspace record.`,
				cause,
			}),
	});
	if (parsedRecord.projectId !== projectId) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} returned workspace ${parsedRecord.projectId}.`,
			}),
		);
	}
	const manifestFile = parsedRecord.files.find(({ path }) => path === "editor.json");
	if (manifestFile === undefined) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} does not contain editor.json.`,
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
				message: `Editor project ${projectId} contains an invalid editor.json.`,
				cause,
			}),
	});
	if (manifest.projectId !== projectId) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} contains manifest ${manifest.projectId}.`,
			}),
		);
	}
	const sourceRecords = parsedRecord.files.filter(({ path }) => path !== "editor.json");
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
	if (!sourceRecords.some(({ path }) => path === "game.json")) {
		const project: EditorProject = {
			...descriptor,
			resources: [],
			diagnostics: [],
		};
		return project;
	}
	const files = yield* Effect.try({
		try: () => EditorSourceFileSchema.array().parse(sourceRecords),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} contains an invalid file record.`,
				cause,
			}),
	});
	const compilation = yield* compileEditorProjectFilesFx(files);
	const project: EditorProject = {
		...descriptor,
		config: compilation.payload.config,
		resources: compilation.payload.resources,
		diagnostics: compilation.diagnostics,
	};
	return project;
});
