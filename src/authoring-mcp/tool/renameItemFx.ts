import { Effect } from "effect";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Changes the title of one immutable item definition. */
export const renameItemFx = Effect.fn("renameItemFx")(function* ({
	itemUid,
	title,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly itemUid: string;
	readonly title: string;
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
	const original = project.config.items[itemUid];
	if (original === undefined)
		return yield* Effect.fail(new Error(`Item ${itemUid} does not exist.`));
	const commit = yield* repository.upsertItemFx({
		item: {
			...original,
			title,
		},
		expectedRevision: revision ?? project.revision,
		projectId: project.projectId,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		"Renamed item.",
		`UID: ${itemUid}`,
		`Title: ${title}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});
