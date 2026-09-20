import { Effect } from "effect";

import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectDescriptorSchema } from "~/project-authoring/schema/ProjectDescriptorSchema";

const readProjectDescriptorFn = (project: {
	readonly projectId: string;
	readonly title: string;
	readonly version: unknown;
	readonly createdAtMs: number;
	readonly updatedAtMs: number;
}) =>
	ProjectDescriptorSchema.parse({
		projectId: project.projectId,
		title: project.title,
		version: project.version,
		createdAtMs: project.createdAtMs,
		updatedAtMs: project.updatedAtMs,
	});

/** Opens a matching project or asks main to stream-import the installed Serapack. */
export const openEditorSerapackFx = Effect.fn("openEditorSerapackFx")(function* (
	packageId: string,
) {
	const repository = yield* ProjectRepository;
	const existing = yield* repository.readProjectFx(packageId);
	if (existing !== null) return readProjectDescriptorFn(existing);
	return yield* invokeProjectTransportFx({
		callFn: () => window.serakki.editor.importInstalledSerapackFn(packageId),
		operation: "import-serapack",
		parseFn: (value) => ProjectDescriptorSchema.parse(value),
		requestMessage: "The installed Serapack import request failed.",
		responseMessage: "The installed Serapack import response is invalid.",
	});
});
