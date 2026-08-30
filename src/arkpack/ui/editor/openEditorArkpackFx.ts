import { Effect } from "effect";

import { loadArkpackFx } from "~/arkpack/renderer/loadArkpackFx";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import type { EditorProjectDescriptor } from "~/project-authoring/schema/EditorProjectDescriptorSchema";

/** Opens an existing matching Editor project or creates it from the installed Arkpack. */
export const openEditorArkpackFx = Effect.fn("openEditorArkpackFx")(function* (packageId: string) {
	const repository = yield* EditorProjectRepository;
	const existing = yield* repository.readProjectFx(packageId);
	if (existing !== null) return existing satisfies EditorProjectDescriptor;

	const { payload } = yield* loadArkpackFx({
		packageId,
	});
	const project = yield* repository.createProjectFx({
		version: payload.version,
		config: payload.config,
		resources: payload.resources,
	});
	return project satisfies EditorProjectDescriptor;
});
