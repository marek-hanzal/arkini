import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";

/** Gives a copied board a fresh identity without sharing its mutable placements. */
export const copyTemplateFn = (
	template: TemplateSchema.Type,
	uid: string,
): TemplateSchema.Type => ({
	...structuredClone(template),
	uid,
	title: `${template.title} (copy)`,
});
