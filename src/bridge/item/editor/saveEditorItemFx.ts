import { Effect } from "effect";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorProjectFromRecordFx } from "~/bridge/editor/createEditorProjectFromRecordFx";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { compileEditorProjectFilesFx } from "~/engine/editor/fx/compileEditorProjectFilesFx";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import { createItemEditorSourceFilesFx } from "~/engine/item/editor/fx/createItemEditorSourceFilesFx";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";
import { createEditorJsonSourceFileFx } from "~/engine/source/editor/fx/createEditorJsonSourceFileFx";

export namespace saveEditorItemFx {
	export interface Props {
		readonly projectId: string;
		readonly expectedRevision: string;
		readonly item: ItemSchema.Type;
		readonly workspace?: EditorWorkspace;
	}
}

const createItemSourceFileFx = Effect.fn("createEditorItemSourceFileFx")(
	(item: ItemSchema.Type) =>
		createItemEditorSourceFilesFx({
			[item.id]: item,
		}).pipe(
			Effect.flatMap((files) =>
				files[0] === undefined
					? Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item ${item.id} did not produce an editor source file.`,
							}),
						)
					: Effect.succeed(files[0]),
			),
		),
);

/**
 * Upserts one item by immutable UID, validates the complete project candidate,
 * then atomically publishes the owning source file.
 */
export const saveEditorItemFx = Effect.fn("saveEditorItemFx")(function* ({
	projectId,
	expectedRevision,
	item: candidate,
	workspace: providedWorkspace,
}: saveEditorItemFx.Props) {
	const item = yield* Effect.try({
		try: () => ItemSchema.parse(candidate),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Item ${candidate.id} does not satisfy its ${candidate.type} schema.`,
				cause,
			}),
	});
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	const record = yield* workspace.readFx(projectId);
	if (record === null || record.revision === undefined) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "project-not-found",
				message: `Editor project ${projectId} is unavailable for a revision-guarded save.`,
			}),
		);
	}
	if (record.revision !== expectedRevision) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} changed after this item was loaded.`,
			}),
		);
	}
	const sourceFiles = yield* Effect.try({
		try: () =>
			EditorSourceFileSchema.array().parse(
				record.files.filter(({ path }) => path !== "editor.json"),
			),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} contains an invalid source snapshot.`,
				cause,
			}),
	});
	const currentCompilation = yield* compileEditorProjectFilesFx(sourceFiles);
	const currentEntry = Object.entries(currentCompilation.payload.config.items).find(
		([, currentItem]) => currentItem.uid === item.uid,
	);

	const mutation =
		currentEntry === undefined
			? {
					mode: "create" as const,
					file: yield* createItemSourceFileFx(item),
				}
			: yield* Effect.gen(function* () {
					const [currentItemId] = currentEntry;
					const sourcePath = currentCompilation.provenance.items[currentItemId];
					if (sourcePath === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item ${currentItemId} has no source provenance.`,
							}),
						);
					}
					const sourceFile = sourceFiles.find(({ path }) => path === sourcePath);
					if (sourceFile === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item source ${sourcePath} no longer exists.`,
							}),
						);
					}
					const source = yield* Effect.try({
						try: () =>
							GameSourceSchema.parse(
								JSON.parse(new TextDecoder().decode(sourceFile.bytes)) as unknown,
							),
						catch: (cause) =>
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item source ${sourcePath} is not a canonical game source.`,
								cause,
							}),
					});
					const items = source.items;
					const sourceEntry = Object.entries(items ?? {}).find(
						([, sourceItem]) => sourceItem.uid === item.uid,
					);
					if (items === undefined || sourceEntry === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item source ${sourcePath} does not own UID ${item.uid}.`,
							}),
						);
					}
					const [sourceItemId] = sourceEntry;
					const conflictingItem = items[item.id];
					if (conflictingItem !== undefined && conflictingItem.uid !== item.uid) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item source ${sourcePath} already owns ${item.id}.`,
							}),
						);
					}
					const nextItems = {
						...items,
					};
					delete nextItems[sourceItemId];
					nextItems[item.id] = item;
					return {
						mode: "replace" as const,
						sourcePath,
						file: yield* createEditorJsonSourceFileFx({
							path: sourcePath,
							value: {
								...source,
								items: nextItems,
							},
						}),
					};
				});
	const candidateFiles =
		mutation.mode === "replace"
			? [
					...sourceFiles.filter(({ path }) => path !== mutation.sourcePath),
					mutation.file,
				]
			: [
					...sourceFiles,
					mutation.file,
				];
	yield* compileEditorProjectFilesFx(candidateFiles);
	const nextRecord = yield* workspace.writeFx({
		projectId,
		file: mutation.file,
		expectedRevision,
		mode: mutation.mode,
	});
	const project = yield* createEditorProjectFromRecordFx(nextRecord);
	return {
		item,
		revision: nextRecord.revision,
		project,
	};
});
