import type { Project } from "~/project-authoring/type/Project";
import { FormSchema } from "~/item-authoring/schema/FormSchema";

/** Adds project-local authored-ID uniqueness to the canonical item form schema. */
export const createFormSchema = (
	project: Pick<Project, "config">,
	itemUid: string,
) =>
	FormSchema.superRefine((item, context) => {
		const existing = project.config.items[item.id];
		if (existing === undefined || existing.uid === itemUid) return;
		context.addIssue({
			code: "custom",
			message: `Item ID ${item.id} is already used by another item.`,
			path: [
				"id",
			],
		});
	});
