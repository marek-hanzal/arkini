import { Effect } from "effect";

import {
	type EditorArkpackFileInput,
	readSelectedArkpackFileFx,
} from "~/arkpack-admission/fx/readSelectedArkpackFileFx";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import type { EditorProjectDescriptor } from "~/project-authoring/schema/EditorProjectDescriptorSchema";

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
	const repository = yield* EditorProjectRepository;
	const project = yield* repository.createProjectFx({
		version: loaded.payload.version,
		config: loaded.payload.config,
		resources: loaded.payload.resources,
	});
	return project satisfies EditorProjectDescriptor;
});
