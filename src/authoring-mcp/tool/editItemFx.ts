import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { EditItemInput } from "./EditItemInputSchemas";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Applies one strict top-level replace patch to a revision-pinned canonical item. */
export const editItemFx = Effect.fn("editItemFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
	type,
}: {
	readonly input: EditItemInput;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly type: TypeSchema.Type;
}) {
	const current = project.config.items[input.itemId];
	if (current === undefined)
		return yield* Effect.fail(new Error(`Item ${input.itemId} does not exist.`));
	if (current.type !== type)
		return yield* Effect.fail(
			new Error(`Item ${input.itemId} is ${current.type}, not ${type}.`),
		);
	if (input.revision !== undefined && input.revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${input.revision} is stale; the open project is at revision ${project.revision}. Read item_config again before replacing structured fields.`,
			),
		);
	const candidate: Pick<ItemSchema.Type, "id" | "type"> & Record<string, unknown> = {
		...current,
	};
	for (const [field, value] of Object.entries(input.patch)) {
		if (value === null) delete candidate[field];
		else candidate[field] = value;
	}
	const { commit, item } = yield* saveWithRepositoryFx({
		config: project.config,
		expectedRevision: input.revision ?? project.revision,
		item: candidate,
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		`Edited ${item.type} item.`,
		`ID: ${item.id}`,
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
		`Replaced: ${Object.keys(input.patch).sort().join(", ")}`,
	].join("\n");
});
