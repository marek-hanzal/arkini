import { Effect } from "effect";

import {
	type EditorArkpackFileInput,
	readEditorArkpackFileFx,
} from "~/ui/arkpack/editor/readEditorArkpackFileFx";
import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import type { EditorProjectDescriptor } from "~/editor/EditorProjectDescriptor";

export namespace importEditorArkpackFileFx {
	export interface Props {
		readonly file: EditorArkpackFileInput;
	}
}

/** Validates one Arkpack and creates one managed filesystem Editor project. */
export const importEditorArkpackFileFx = Effect.fn("importEditorArkpackFileFx")(function* ({
	file,
}: importEditorArkpackFileFx.Props) {
	const loaded = yield* readEditorArkpackFileFx(file);
	const repository = yield* EditorProjectRepository;
	const project = yield* repository.createProjectFx({
		version: loaded.payload.version,
		config: loaded.payload.config,
		resources: loaded.payload.resources,
	});
	return project satisfies EditorProjectDescriptor;
});
