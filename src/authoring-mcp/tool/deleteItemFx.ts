import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";
import { readItemDeleteImpactFx } from "./readItemDeleteImpactFx";

/** Deletes one item against the exact revision previously inspected by the caller. */
export const deleteItemFx = Effect.fn("deleteItemFx")(function* ({
	force,
	itemUid,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly force: boolean;
	readonly itemUid: string;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision: number;
}) {
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_delete_impact again before deleting the item.`,
			),
		);
	const { blockers, item } = yield* readItemDeleteImpactFx(project, itemUid);
	const commit = yield* repository.deleteItemFx({
		expectedRevision: revision,
		force,
		itemUid: item.uid,
		projectId: project.projectId,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		"Deleted item.",
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
		`Mode: ${force ? "force" : "safe"}`,
		`References removed: ${force ? blockers.length : 0}`,
	].join("\n");
});
