import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { editLinesFx } from "~/item-authoring/fx/editLinesFx";
import type { CreateItemLineInputSchema } from "./CreateItemLineInputSchema";
import type { DeleteItemLineInputSchema } from "./DeleteItemLineInputSchema";
import type { ReplaceItemLineInputSchema } from "./ReplaceItemLineInputSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** One revision-guarded line edit; the repository rechecks admission before committing. */
export const mutateItemLineFx = Effect.fn("mutateItemLineFx")(function* ({
	input,
	notifyProjectChangedFn,
	project,
	repository,
}: {
	readonly input: mutateItemLineFx.Command;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
}) {
	const lineId = input.operation === "create" ? input.line.id : input.lineId;
	const commit = yield* editLinesFx({
		project,
		revision: input.revision,
		operations: [
			input,
		],
		repository,
	});

	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		`${input.operation === "create" ? "Created" : input.operation === "delete" ? "Deleted" : "Replaced"} item line.`,
		`Item ID: ${input.itemId}`,
		`Line ID: ${lineId}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});

export namespace mutateItemLineFx {
	export type Command =
		| (CreateItemLineInputSchema.Type & {
				readonly operation: "create";
		  })
		| (ReplaceItemLineInputSchema.Type & {
				readonly operation: "replace";
		  })
		| (DeleteItemLineInputSchema.Type & {
				readonly operation: "delete";
		  });
}
