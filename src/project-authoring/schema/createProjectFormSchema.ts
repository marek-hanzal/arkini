import type { Project } from "~/project-authoring/type/Project";
import { ProjectFormBaseSchema } from "~/project-authoring/schema/ProjectFormSchema";

/** Adds project-local resource and authored-start invariants to canonical field schemas. */
export const createProjectFormSchema = (project: Pick<Project, "config" | "resources">) => {
	const resourceTypes = new Map(
		project.resources.map(({ id, type }) => [
			id,
			type,
		]),
	);

	return ProjectFormBaseSchema.superRefine((value, context) => {
		if (resourceTypes.get(value.hero) !== "image") {
			context.addIssue({
				code: "custom",
				message: `Hero image ${value.hero} does not exist in this project.`,
				path: [
					"hero",
				],
			});
		}
		const seenAvatars = new Set<string>();
		value.avatars.forEach((avatar, index) => {
			if (resourceTypes.get(avatar) !== "image") {
				context.addIssue({
					code: "custom",
					message: `Avatar image ${avatar} does not exist in this project.`,
					path: [
						"avatars",
						index,
					],
				});
			}
			if (seenAvatars.has(avatar)) {
				context.addIssue({
					code: "custom",
					message: `Avatar image ${avatar} is already selected.`,
					path: [
						"avatars",
						index,
					],
				});
			}
			seenAvatars.add(avatar);
		});

		const validateItemFn = (itemId: string, path: (string | number)[]) => {
			const item = project.config.items[itemId];
			if (item === undefined) {
				context.addIssue({
					code: "custom",
					message: `Initial item ${itemId} does not exist in this project.`,
					path,
				});
				return;
			}
		};

		const boardLocations = new Set<string>();
		value.start.board.forEach((startItem, index) => {
			const path = [
				"start",
				"board",
				index,
			];
			validateItemFn(startItem.itemId, path);
			if (startItem.x >= value.board.width || startItem.y >= value.board.height) {
				context.addIssue({
					code: "custom",
					message: `Initial board item ${startItem.itemId} at ${startItem.x}, ${startItem.y} does not fit inside the board.`,
					path: [
						"board",
						startItem.x >= value.board.width ? "width" : "height",
					],
				});
			}
			const key = `${startItem.space}:${startItem.x}:${startItem.y}`;
			if (boardLocations.has(key)) {
				context.addIssue({
					code: "custom",
					message: `Initial board slot ${startItem.x}, ${startItem.y} in space ${startItem.space} is used more than once.`,
					path,
				});
			}
			boardLocations.add(key);
		});
	});
};
