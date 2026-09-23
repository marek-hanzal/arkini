import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { CreateItemInputSchema } from "./CreateItemInputSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Creates one item from the same draft and persistence path as the Editor UI. */
export const createItemFx = Effect.fn("createItemFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
}: {
	readonly input: CreateItemInputSchema.Type;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
}) {
	const draft = createDraftFn({
		resourceUid:
			project.resources.find(({ type }) => type === "artwork")?.uid ?? "missing-artwork",
		uid: createId(),
	});
	const { commit, item } = yield* saveWithRepositoryFx({
		item: {
			...draft,
			...input,
			lines:
				input.lines?.map((line) => ({
					...line,
					uid: createId(),
				})) ?? [],
		},
		projectId: project.projectId,
		repository,
	});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		"Created item.",
		`UID: ${item.uid}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});
