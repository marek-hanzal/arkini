import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { renameEditorItemFx } from "~/editor/renameEditorItemFx";
import { notifyEditorMcpProjectChangedFx } from "./notifyEditorMcpProjectChangedFx";

/** Renames an item through a revision-pinned whole-config commit. */
export const renameEditorMcpItemFx = Effect.fn("renameEditorMcpItemFx")(function* ({
	itemId,
	newItemId,
	notifyProjectChanged,
	project,
	repository,
	revision,
}: {
	readonly itemId: string;
	readonly newItemId: string;
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly project: EditorProject;
	readonly repository: EditorProjectRepositoryService;
	readonly revision?: number;
}) {
	if (revision !== undefined && revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_config again before renaming the item.`,
			),
		);
	const renamed = yield* renameEditorItemFx({
		config: project.config,
		itemId,
		newItemId,
	});
	const commit = yield* repository.replaceConfigFx({
		config: renamed.config,
		expectedRevision: revision ?? project.revision,
		projectId: project.projectId,
	});
	yield* notifyEditorMcpProjectChangedFx(notifyProjectChanged, project.projectId);
	const item = renamed.config.items[newItemId];
	if (item === undefined) return yield* Effect.die(new Error("Renamed item is missing."));
	return [
		"Renamed item.",
		`Previous ID: ${itemId}`,
		`ID: ${newItemId}`,
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
		`Updated references: ${renamed.updatedReferencePaths.length}`,
	].join("\n");
});
