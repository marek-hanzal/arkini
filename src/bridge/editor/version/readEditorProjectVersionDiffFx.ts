import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorProjectVersionDiffInput } from "~/editor/version/EditorProjectVersion";

export const readEditorProjectVersionDiffFx = Effect.fn("readEditorProjectVersionDiffFx")(
	(input: EditorProjectVersionDiffInput) =>
		Effect.flatMap(EditorProjectRepository, (repository) => repository.diffVersionsFx(input)),
);
