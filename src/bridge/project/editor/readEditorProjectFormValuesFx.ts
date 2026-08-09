import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	type EditorProjectFormSchema,
	EditorProjectAvatarKeys,
} from "~/bridge/project/editor/EditorProjectFormSchema";

/** Reads one canonical Project form value from the current project snapshot. */
export const readEditorProjectFormValuesFx = Effect.fn("readEditorProjectFormValuesFx")(
	(project: Pick<EditorProject, "config">) =>
		Effect.sync(
			(): EditorProjectFormSchema.Type => ({
				title: project.config.meta.title,
				hero: project.config.resources.hero,
				avatars: EditorProjectAvatarKeys.flatMap((key) => {
					const resourceId = project.config.resources[key];
					return resourceId === undefined
						? []
						: [
								resourceId,
							];
				}),
				board: {
					...project.config.meta.board,
				},
				inventory: {
					...project.config.meta.inventory,
				},
				toolbarSize: project.config.meta.toolbarSize ?? 0,
			}),
		),
);
