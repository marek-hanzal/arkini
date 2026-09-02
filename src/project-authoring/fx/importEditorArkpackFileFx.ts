import { Effect } from "effect";

import {
	type EditorArkpackFileInput,
	readSelectedArkpackFileFx,
} from "~/arkpack-admission/fx/readSelectedArkpackFileFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { ProjectDescriptor } from "~/project-authoring/schema/ProjectDescriptorSchema";

export namespace importEditorArkpackFileFx {
	export interface Props {
		readonly file: EditorArkpackFileInput;
	}
}

/** Validates one Arkpack and creates one managed filesystem Editor project. */
export const importEditorArkpackFileFx = Effect.fn("importEditorArkpackFileFx")(function* ({
	file,
}: importEditorArkpackFileFx.Props) {
	const loaded = yield* readSelectedArkpackFileFx(file);
	const repository = yield* ProjectRepository;
	const project = yield* repository.createProjectFx({
		version: loaded.payload.version,
		config: loaded.payload.config,
		initialVersionSubject: `Imported Arkpack v${loaded.payload.version}`,
		resources: loaded.payload.resources,
	});
	return project satisfies ProjectDescriptor;
});
