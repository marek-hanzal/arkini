import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorProjectRepositoryService } from "~/project-authoring/repository/EditorProjectRepository";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";
import { readItemDeleteImpactFx } from "./readItemDeleteImpactFx";

/** Deletes one item against the exact revision previously inspected by the caller. */
export const deleteItemFx = Effect.fn("deleteItemFx")(function* ({
	force,
	itemId,
	notifyProjectChanged,
	project,
	repository,
	revision,
}: {
	readonly force: boolean;
	readonly itemId: string;
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly project: EditorProject;
	readonly repository: EditorProjectRepositoryService;
	readonly revision: number;
}) {
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_delete_impact again before deleting the item.`,
			),
		);
	const { blockers, impact, item } = yield* readItemDeleteImpactFx(project, itemId);
	const commit = yield* repository.deleteItemFx({
		expectedRevision: revision,
		force,
		itemUid: item.uid,
		projectId: project.projectId,
	});
	yield* notifyProjectChangedFx(notifyProjectChanged, project.projectId);
	return [
		"Deleted item.",
		`ID: ${itemId}`,
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
		`Mode: ${force ? "force" : "safe"}`,
		`References removed: ${force ? blockers.length : 0}`,
		`Owner items deleted: ${impact.deletedOwnerItemIds.length}`,
	].join("\n");
});
