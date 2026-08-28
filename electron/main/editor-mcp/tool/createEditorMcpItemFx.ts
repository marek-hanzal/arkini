import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { createEditorItemDraftFx } from "~/editor/createEditorItemDraftFx";
import { saveEditorItemWithRepositoryFx } from "~/editor/saveEditorItemWithRepositoryFx";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { EditorMcpCreateItemInput } from "./EditorMcpCreateItemInputSchemas";
import { notifyEditorMcpProjectChangedFx } from "./notifyEditorMcpProjectChangedFx";

/** Creates one type-owned item from the same draft and persistence path as the Editor UI. */
export const createEditorMcpItemFx = Effect.fn("createEditorMcpItemFx")(function* ({
	input,
	notifyProjectChanged,
	project,
	repository,
	type,
}: {
	readonly input: EditorMcpCreateItemInput;
	readonly notifyProjectChanged: (projectId: string) => void;
	readonly project: EditorProject;
	readonly repository: EditorProjectRepositoryService;
	readonly type: TypeSchema.Type;
}) {
	const draft = yield* createEditorItemDraftFx({
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
	yield* notifyEditorMcpProjectChangedFx(notifyProjectChanged, project.projectId);
	return [
		`Created ${item.type} item.`,
		`ID: ${item.id}`,
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});
