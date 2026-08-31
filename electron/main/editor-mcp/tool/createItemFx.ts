import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { EditorProjectRepositoryService } from "~/project-authoring/service/EditorProjectRepository";
import { createEditorItemDraftFn } from "~/item-authoring/fn/createEditorItemDraftFn";
import { saveEditorItemWithRepositoryFx } from "~/item-authoring/fx/saveEditorItemWithRepositoryFx";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { CreateItemInput } from "./CreateItemInputSchemas";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Creates one type-owned item from the same draft and persistence path as the Editor UI. */
export const createItemFx = Effect.fn("createItemFx")(function* ({
	input,
	notifyProjectChanged,
	project,
	repository,
	type,
}: {
	readonly input: CreateItemInput;
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly project: EditorProject;
	readonly repository: EditorProjectRepositoryService;
	readonly type: TypeSchema.Type;
}) {
	const draft = createEditorItemDraftFn({
		resourceId: project.resources[0]?.id ?? "missing-asset",
		type,
		uid: createId(),
	});
	const { commit, item } = yield* saveEditorItemWithRepositoryFx({
		item: {
			...draft,
			...input,
			type,
		},
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChanged, project.projectId);
	return [
		`Created ${item.type} item.`,
		`ID: ${item.id}`,
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});
