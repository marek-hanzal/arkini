import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	type EditorProjectFormSchema,
	EditorProjectAvatarKeys,
} from "~/bridge/project/editor/EditorProjectFormSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export const createEditorProjectConfig = (
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
	return GameConfigSchema.parse({
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
	});
};
