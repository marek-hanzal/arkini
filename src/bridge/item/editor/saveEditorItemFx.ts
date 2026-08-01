import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorProjectFromWriteFx } from "~/bridge/editor/createEditorProjectFromWriteFx";
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
		readonly expectedRevision: string;
		readonly item: ItemSchema.Type;
		readonly project: EditorProject;
		readonly workspace?: EditorWorkspace;
	}
}

const createItemSourceFileFx = Effect.fn("createEditorItemSourceFileFx")((item: ItemSchema.Type) =>
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

/** Upserts one item against the already loaded project index and persists only its source delta. */
export const saveEditorItemFx = Effect.fn("saveEditorItemFx")(function* ({
	expectedRevision,
	item: candidate,
	project,
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
	if (project.revision !== expectedRevision) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${project.projectId} changed after this item was loaded.`,
			}),
		);
	}
	const sourceFiles = yield* Effect.try({
		try: () =>
			EditorSourceFileSchema.array().parse(
				Object.values(project.fileIndex).filter(({ path }) => path !== "editor.json"),
			),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${project.projectId} contains an invalid in-memory source index.`,
				cause,
			}),
	});
	const currentEntry =
		project.config === undefined
			? undefined
			: Object.entries(project.config.items).find(
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
					const sourcePath = project.itemSourcePaths[currentItemId];
					if (sourcePath === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item ${currentItemId} has no source provenance.`,
							}),
						);
					}
					const sourceFile = project.fileIndex[sourcePath];
					if (sourceFile === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "unsupported-project-file",
								message: `Item source ${sourcePath} no longer exists in memory.`,
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
	const compilation = yield* compileEditorProjectFilesFx(candidateFiles);
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	const write = yield* workspace.writeFx({
		projectId: project.projectId,
		file: mutation.file,
		expectedRevision,
		mode: mutation.mode,
	});
	const nextProject = yield* createEditorProjectFromWriteFx({
		compilation,
		project,
		write,
	});
	return {
		item,
		revision: write.revision,
		project: nextProject,
	};
});
