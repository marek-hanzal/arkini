import type { Project } from "~/project-authoring/type/Project";
import { ProjectFormBaseSchema } from "~/project-authoring/schema/ProjectFormSchema";

/** Adds project-local resource and authored-start invariants to canonical field schemas. */
export const createProjectFormSchema = (project: Pick<Project, "config" | "resources">) => {
	const resourceTypes = new Map(
		project.resources.map(({ uid, type }) => [
			uid,
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

		const templateUids = new Set(value.templates.map((template) => template.uid));
		value.start.spaces.forEach((entry, index) => {
			if (!templateUids.has(entry.templateUid))
				context.addIssue({
					code: "custom",
					message: "Select an existing template.",
					path: [
						"start",
						"spaces",
						index,
						"templateUid",
					],
				});
		});
		value.templates.forEach((template, index) => {
			template.board.forEach((cell, cellIndex) => {
				if (project.config.items[cell.itemUid] === undefined)
					context.addIssue({
						code: "custom",
						message: `Item ${cell.itemUid} does not exist in this project.`,
						path: [
							"templates",
							index,
							"board",
							cellIndex,
							"itemUid",
						],
					});
			});
		});
	});
};
