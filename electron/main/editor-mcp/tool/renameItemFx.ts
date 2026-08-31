import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { renameFx } from "~/item-authoring/fx/renameFx";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Renames an item through a revision-pinned whole-config commit. */
export const renameItemFx = Effect.fn("renameItemFx")(function* ({
	itemId,
	newItemId,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly itemId: string;
	readonly newItemId: string;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision?: number;
}) {
	if (revision !== undefined && revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_config again before renaming the item.`,
			),
		);
	const renamed = yield* renameFx({
		config: project.config,
		itemId,
		newItemId,
	});
	const commit = yield* repository.replaceConfigFx({
		config: renamed.config,
		expectedRevision: revision ?? project.revision,
		projectId: project.projectId,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
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
