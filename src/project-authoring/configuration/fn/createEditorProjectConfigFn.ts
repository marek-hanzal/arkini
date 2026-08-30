import type { EditorProject } from "~/project-authoring/EditorProject";
import {
	type EditorProjectFormSchema,
	EditorProjectAvatarKeys,
} from "~/project-authoring/configuration/EditorProjectFormSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

/** Rebuilds the complete canonical config from one validated Project form value. */
export const createEditorProjectConfigFn = (
	project: Pick<EditorProject, "config">,
	value: EditorProjectFormSchema.Type,
): GameConfigSchema.Type => {
	const avatarResources = Object.fromEntries(
		EditorProjectAvatarKeys.flatMap((key, index) => {
			const resourceId = value.avatars[index];
			return resourceId === undefined
				? []
				: [
						[
							key,
							resourceId,
						],
					];
		}),
	);
	return {
		...project.config,
		meta: {
			...project.config.meta,
			title: value.title,
			board: value.board,
			inventory: value.inventory,
			toolbarSize: value.toolbarSize,
		},
		resources: {
			hero: value.hero,
			...avatarResources,
		},
		start: value.start,
	};
};
