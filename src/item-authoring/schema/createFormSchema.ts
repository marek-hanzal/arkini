import { readItemOutcomeEntriesFn } from "~/game-config-validation/fn/readItemOutcomeEntriesFn";
import type { Project } from "~/project-authoring/type/Project";
import { FormSchema } from "~/item-authoring/schema/FormSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";

interface InputCollection {
	readonly input: ReadonlyArray<InputSchema.Type>;
	readonly path: ReadonlyArray<string | number>;
}

const readInputCollectionsFn = (item: ItemSchema.Type): ReadonlyArray<InputCollection> => {
	const collections: InputCollection[] = [];
	if ("lines" in item)
		for (const [index, line] of item.lines.entries())
			collections.push({
				input: line.input,
				path: [
					"lines",
					index,
				],
			});
	return collections;
};

/** Adds project-local identity and selected-target validation to the canonical item form schema. */
export const createFormSchema = (project: Pick<Project, "config">, _itemUid: string) =>
	FormSchema.superRefine((item, context) => {
		for (const entry of readItemOutcomeEntriesFn({
			itemUid: item.uid,
			item,
		})) {
			for (const [setIndex, set] of entry.outcome.set.entries())
				for (const [rollIndex, roll] of set.roll.entries())
					for (const [outcomeIndex, outcome] of roll.outcome.entries()) {
						if (
							outcome.type !== "template" ||
							(project.config.templates ?? []).some(
								({ uid }) => uid === outcome.templateUid,
							)
						)
							continue;
						context.addIssue({
							code: "custom",
							message: "Select an existing template.",
							path: [
								...entry.path.slice(2),
								"set",
								setIndex,
								"roll",
								rollIndex,
								"outcome",
								outcomeIndex,
								"templateUid",
							],
						});
					}
		}
		for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
			if (merge.action === "spend" && item.units === undefined)
				context.addIssue({
					code: "custom",
					message: "Enable Units on this item before selecting Spend.",
					path: [
						"merge",
						mergeIndex,
						"action",
					],
				});
			if (merge.effect !== "spend") continue;
			const selectedItem =
				merge.action === "space" ? item : project.config.items[merge.target.itemUid];
			const target = selectedItem?.uid === item.uid ? item : selectedItem;
			if (target === undefined || target.units !== undefined) continue;
			context.addIssue({
				code: "custom",
				message: "Selected target must have Units enabled before choosing Spend.",
				path: [
					"merge",
					mergeIndex,
					"effect",
				],
			});
		}
		for (const collection of readInputCollectionsFn(item)) {
			for (const [inputIndex, input] of collection.input.entries()) {
				if (input.type !== "units") continue;
				if (input.units?.from === "self") {
					if (item.units !== undefined) continue;
					context.addIssue({
						code: "custom",
						message: "Enable Units on this item before selecting Self.",
						path: [
							...collection.path,
							"input",
							inputIndex,
							"units",
							"from",
						],
					});
					continue;
				}
				if (input.units?.from !== "target") continue;
				const selectedItem = project.config.items[input.query.selector.itemUid];
				const target = selectedItem?.uid === item.uid ? item : selectedItem;
				if (target === undefined || target.units !== undefined) continue;
				context.addIssue({
					code: "custom",
					message: "Selected target must have Units enabled.",
					path: [
						...collection.path,
						"input",
						inputIndex,
						"query",
						"selector",
						"itemUid",
					],
				});
			}
		}
	});
