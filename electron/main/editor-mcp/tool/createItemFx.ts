import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
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
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly type: TypeSchema.Type;
}) {
	const draft = createDraftFn({
		resourceId: project.resources[0]?.id ?? "missing-asset",
		type,
		uid: createId(),
	});
	const { commit, item } = yield* saveWithRepositoryFx({
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
