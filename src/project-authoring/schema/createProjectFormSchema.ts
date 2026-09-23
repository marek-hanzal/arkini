import type { Project } from "~/project-authoring/type/Project";
import {
	ProjectAvatarKeys,
	ProjectFormBaseSchema,
} from "~/project-authoring/schema/ProjectFormSchema";

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
		for (const slot of ProjectAvatarKeys) {
			const resourceUid = value.avatars[slot];
			if (resourceUid === "") continue;
			if (resourceTypes.get(resourceUid) !== "image") {
				context.addIssue({
					code: "custom",
					message: `Avatar image ${resourceUid} does not exist in this project.`,
					path: [
						"avatars",
						slot,
					],
				});
			}
			if (seenAvatars.has(resourceUid)) {
				context.addIssue({
					code: "custom",
					message: `Avatar image ${resourceUid} is already selected.`,
					path: [
						"avatars",
						slot,
					],
				});
			}
			seenAvatars.add(resourceUid);
		}

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
