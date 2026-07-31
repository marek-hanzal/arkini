import { Effect } from "effect";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorProjectFromCompilationFx } from "~/bridge/editor/createEditorProjectFromCompilationFx";
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
		readonly sourceItemId?: string;
		readonly sourcePath?: string;
		readonly workspace?: EditorWorkspace;
	}
}

/**
 * Validates one item in the context of the complete project before publishing
 * its one-item source fragment through the contained editor workspace.
 */
export const saveEditorItemFx = Effect.fn("saveEditorItemFx")(function* ({
	projectId,
	expectedRevision,
	item: candidate,
	sourceItemId,
	sourcePath,
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
				message: `Editor project ${projectId} changed after this draft was loaded.`,
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
	const mode = sourcePath === undefined ? "create" : "replace";
	const file =
		mode === "create"
			? yield* createItemEditorSourceFilesFx({
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
				)
			: yield* Effect.gen(function* () {
					if (sourcePath === undefined) {
						return yield* Effect.die("Replace mode requires an item source path.");
					}
					if (sourceItemId === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Editing ${item.id} requires its original source item key.`,
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
					if (items === undefined || !Object.hasOwn(items, sourceItemId)) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item source ${sourcePath} does not own ${sourceItemId}.`,
							}),
						);
					}
					if (sourceItemId !== item.id && Object.hasOwn(items, item.id)) {
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
					return yield* createEditorJsonSourceFileFx({
						path: sourcePath,
						value: {
							...source,
							items: nextItems,
						},
					});
				});
	const candidateFiles =
		mode === "replace"
			? [
					...sourceFiles.filter(({ path }) => path !== sourcePath),
					file,
				]
			: [
					...sourceFiles,
					file,
				];
	const compilation = yield* compileEditorProjectFilesFx(candidateFiles);
	const revision = yield* workspace.writeFileFx({
		projectId,
		file,
		expectedRevision,
		mode,
	});
	const project = yield* createEditorProjectFromCompilationFx({
		compilation,
		record,
		revision,
	});
	return {
		item,
		revision,
		project,
	};
});
