import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorProjectVersionCommitInput } from "~/editor/version/EditorProjectVersion";

export const commitEditorProjectVersionFx = Effect.fn("commitEditorProjectVersionFx")(
	(input: EditorProjectVersionCommitInput) =>
		Effect.flatMap(EditorProjectRepository, (repository) => repository.createVersionFx(input)),
);
