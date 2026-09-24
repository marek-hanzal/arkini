import { Effect } from "effect";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

/** Changes one initial-space assignment without mutating the reusable template. */
export const updateStartSpaceFx = Effect.fn("updateStartSpaceFx")(function* ({
	change,
	space,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly change:
		| {
				readonly type: "set";
				readonly templateUid: string;
		  }
		| {
				readonly type: "remove";
		  };
	readonly space: number;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision: number;
}) {
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read project_json again before editing initial spaces.`,
			),
		);
	const previous = project.config.start.spaces.find((entry) => entry.space === space);
	if (change.type === "remove" && previous === undefined)
		return yield* Effect.fail(new Error(`No initial template is assigned to space ${space}.`));
	if (
		change.type === "set" &&
		!project.config.templates?.some((template) => template.uid === change.templateUid)
	)
		return yield* Effect.fail(
			new Error(`Template ${change.templateUid} does not exist in the open project.`),
		);
	const spaces = project.config.start.spaces.filter((entry) => entry.space !== space);
	if (change.type === "set")
		spaces.push({
			space,
			templateUid: change.templateUid,
		});
	const commit = yield* commitProjectConfigFx({
		config: {
			...project.config,
			start: {
				...project.config.start,
				spaces,
			},
		},
		notifyProjectChangedFn,
		project,
		repository,
		revision,
	});
	return [
		change.type === "set" ? "Set initial space template." : "Removed initial space template.",
		`Project ID: ${project.projectId}`,
		`Space: ${space}`,
		`Revision: ${commit.revision}`,
	].join("\n");
});
