import { readItemOutcomeEntriesFn } from "~/game-config-validation/fn/readItemOutcomeEntriesFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

export namespace readItemTemplateReferencesFn {
	export interface Reference {
		readonly templateUid: string;
		readonly path: Array<string | number>;
	}
}

/** Exact item-local authored references shared by build, form and repository admission. */
export const readItemTemplateReferencesFn = (
	item: ItemSchema.Type,
): readonly readItemTemplateReferencesFn.Reference[] => {
	const references: readItemTemplateReferencesFn.Reference[] = [];
	for (const entry of readItemOutcomeEntriesFn({
		itemUid: item.uid,
		item,
	}))
		for (const [setIndex, set] of entry.outcome.set.entries())
			for (const [rollIndex, roll] of set.roll.entries())
				for (const [outcomeIndex, outcome] of roll.outcome.entries()) {
					const path = [
						...entry.path.slice(2),
						"set",
						setIndex,
						"roll",
						rollIndex,
						"outcome",
						outcomeIndex,
					];
					if (outcome.type === "template")
						references.push({
							templateUid: outcome.templateUid,
							path: [
								...path,
								"templateUid",
							],
						});
					if (outcome.type === "space" && typeof outcome.space === "object")
						references.push({
							templateUid: outcome.space.templateUid,
							path: [
								...path,
								"space",
								"templateUid",
							],
						});
				}
	for (const [index, merge] of (item.merge ?? []).entries())
		if (merge.action === "space" && typeof merge.space === "object")
			references.push({
				templateUid: merge.space.templateUid,
				path: [
					"merge",
					index,
					"space",
					"templateUid",
				],
			});
	return references;
};
