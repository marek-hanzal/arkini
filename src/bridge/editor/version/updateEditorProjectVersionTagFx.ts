import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorProjectVersionTagInput } from "~/editor/version/EditorProjectVersion";

export const updateEditorProjectVersionTagFx = Effect.fn("updateEditorProjectVersionTagFx")(
	(input: EditorProjectVersionTagInput) =>
		Effect.flatMap(EditorProjectRepository, (repository) =>
			repository.updateVersionTagFx(input),
		),
);
