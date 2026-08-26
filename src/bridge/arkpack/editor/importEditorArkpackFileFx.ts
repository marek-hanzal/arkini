import { Effect } from "effect";

import {
	type EditorArkpackFileInput,
	readEditorArkpackFileFx,
} from "~/bridge/arkpack/editor/readEditorArkpackFileFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

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
		projectId: loaded.payload.packageId,
		version: loaded.payload.version,
		config: loaded.payload.config,
		resources: loaded.payload.resources,
	});
	return project satisfies EditorProjectDescriptor;
});
