import { match } from "ts-pattern";
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
	const { commit, operations } = yield* editLinesFx({
		project,
		revision: input.revision,
		operations: [
			input,
		],
		repository,
	});

	const operation = operations[0]!;
	const lineUid = operation.operation === "create" ? operation.line.uid : operation.lineUid;
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	return [
		`${match(input.operation)
			.with("create", () => "Created")
			.with("delete", () => "Deleted")
			.with("replace", () => "Replaced")
			.exhaustive()} item line.`,
		`Item UID: ${input.itemUid}`,
		`Line UID: ${lineUid}`,
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
