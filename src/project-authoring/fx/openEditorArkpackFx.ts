import { Effect } from "effect";

import { loadArkpackFx } from "~/arkpack-catalog/fx/loadArkpackFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { ProjectDescriptor } from "~/project-authoring/schema/ProjectDescriptorSchema";

/** Opens an existing matching Editor project or creates it from the installed Arkpack. */
export const openEditorArkpackFx = Effect.fn("openEditorArkpackFx")(function* (packageId: string) {
	const repository = yield* ProjectRepository;
	const existing = yield* repository.readProjectFx(packageId);
	if (existing !== null) return existing satisfies ProjectDescriptor;

	const { payload } = yield* loadArkpackFx({
		packageId,
	});
	const project = yield* repository.createProjectFx({
		version: payload.version,
		config: payload.config,
		initialVersionSubject: `Imported Arkpack v${payload.version}`,
		resources: payload.resources,
	});
	return project satisfies ProjectDescriptor;
});
