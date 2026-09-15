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

/** Opens a matching project or asks main to stream-import the installed Arkpack. */
export const openEditorArkpackFx = Effect.fn("openEditorArkpackFx")(function* (packageId: string) {
	const repository = yield* ProjectRepository;
	const existing = yield* repository.readProjectFx(packageId);
	if (existing !== null) return readProjectDescriptorFn(existing);
	return yield* invokeProjectTransportFx({
		callFn: () => window.arkini.editor.importInstalledArkpackFn(packageId),
		operation: "import-arkpack",
		parseFn: (value) => ProjectDescriptorSchema.parse(value),
		requestMessage: "The installed Arkpack import request failed.",
		responseMessage: "The installed Arkpack import response is invalid.",
	});
});
