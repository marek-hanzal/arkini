import type { Project } from "~/project-authoring/type/Project";
import { FormSchema } from "~/item-authoring/schema/FormSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";

interface InputCollection {
	readonly input: ReadonlyArray<InputSchema.Type>;
	readonly path: ReadonlyArray<string | number>;
}

const readInputCollectionsFn = (item: ItemSchema.Type): ReadonlyArray<InputCollection> => {
	if ("lines" in item)
		return (item.lines ?? []).map((line, index) => ({
			input: line.input,
			path: [
				"lines",
				index,
			],
		}));
	if ("line" in item)
		return [
			{
				input: item.line.input,
				path: [
					"line",
				],
			},
		];
	if (item.type === "space")
		return [
			{
				input: item.input,
				path: [],
			},
		];
	return [];
};

/** Adds project-local identity and selected-target validation to the canonical item form schema. */
export const createFormSchema = (project: Pick<Project, "config">, itemUid: string) =>
	FormSchema.superRefine((item, context) => {
		const existing = project.config.items[item.id];
		if (existing !== undefined && existing.uid !== itemUid) {
			context.addIssue({
				code: "custom",
				message: `Item ID ${item.id} is already used by another item.`,
				path: [
					"id",
				],
			});
		}
		for (const collection of readInputCollectionsFn(item)) {
			for (const [inputIndex, input] of collection.input.entries()) {
				if (input.type !== "deposit") continue;
				if (input.charges?.from === "self") {
					if (item.charges !== undefined) continue;
					context.addIssue({
						code: "custom",
						message: "Enable Charges on this item before selecting Self.",
						path: [
							...collection.path,
							"input",
							inputIndex,
							"charges",
							"from",
						],
					});
					continue;
				}
				if (input.charges?.from !== "target") continue;
				const selectedItem = project.config.items[input.query.selector.itemId];
				const target = selectedItem?.uid === item.uid ? item : selectedItem;
				if (target === undefined || target.charges !== undefined) continue;
				context.addIssue({
					code: "custom",
					message: `Selected target ${target.id} must have Charges enabled.`,
					path: [
						...collection.path,
						"input",
						inputIndex,
						"query",
						"selector",
						"itemId",
					],
				});
			}
		}
	});
