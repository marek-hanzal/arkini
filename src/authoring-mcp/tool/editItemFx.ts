import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { EditItemInputSchema } from "./EditItemInputSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Applies one strict top-level replace patch to a revision-pinned canonical item. */
export const editItemFx = Effect.fn("editItemFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
}: {
	readonly input: EditItemInputSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
}) {
	const current = Object.hasOwn(project.config.items, input.itemUid)
		? project.config.items[input.itemUid]
		: undefined;
	if (current === undefined)
		return yield* Effect.fail(new Error(`Item ${input.itemUid} does not exist.`));
	if (input.revision !== undefined && input.revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${input.revision} is stale; the open project is at revision ${project.revision}. Read item_config again before replacing structured fields.`,
			),
		);
	const candidate: Pick<ItemSchema.Type, "uid"> & Record<string, unknown> = {
		...current,
	};
	for (const [field, value] of Object.entries(input.patch)) {
		if (value === null) delete candidate[field];
		else candidate[field] = value;
	}
	const { commit, item } = yield* saveWithRepositoryFx({
		expectedRevision: input.revision ?? project.revision,
		item: candidate,
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		"Edited item.",
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
		`Replaced: ${Object.keys(input.patch).sort().join(", ")}`,
	].join("\n");
});
