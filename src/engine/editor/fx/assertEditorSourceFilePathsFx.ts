import { Effect } from "effect";

import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import type { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";

/** Rejects source paths that alias each other on supported case-insensitive filesystems. */
export const assertEditorSourceFilePathsFx = Effect.fn("assertEditorSourceFilePathsFx")(
	(files: ReadonlyArray<EditorSourceFileSchema.Type>) =>
		Effect.gen(function* () {
			const firstPathByKey = new Map<string, string>();
			for (const file of files) {
				const collisionKey = file.path.toLowerCase();
				const firstPath = firstPathByKey.get(collisionKey);
				if (firstPath !== undefined) {
					return yield* Effect.fail(
						new EditorProjectError({
							reason: "path-collision",
							message: `Editor source paths ${firstPath} and ${file.path} collide on a case-insensitive filesystem.`,
						}),
					);
				}
				firstPathByKey.set(collisionKey, file.path);
			}
		}),
);
