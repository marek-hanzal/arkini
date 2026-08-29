import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorProjectRepositoryService } from "~/project-authoring/repository/EditorProjectRepository";
import { saveEditorItemWithRepositoryFx } from "~/item-authoring/domain/fx/saveEditorItemWithRepositoryFx";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { EditItemInput } from "./EditItemInputSchemas";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Applies one strict top-level replace patch to a revision-pinned canonical item. */
export const editItemFx = Effect.fn("editItemFx")(function* ({
	input,
	notifyProjectChanged,
	project,
	repository,
	type,
}: {
	readonly input: EditItemInput;
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly project: EditorProject;
	readonly repository: EditorProjectRepositoryService;
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
	const { commit, item } = yield* saveEditorItemWithRepositoryFx({
		expectedRevision: input.revision ?? project.revision,
		item: candidate,
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChanged, project.projectId);
	return [
		`Edited ${item.type} item.`,
		`ID: ${item.id}`,
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
		`Replaced: ${Object.keys(input.patch).sort().join(", ")}`,
	].join("\n");
});
