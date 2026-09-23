import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { readItemOutcomeEntriesFn } from "~/game-config-validation/fn/readItemOutcomeEntriesFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

export namespace readTemplateReferenceIssuesFn {
	export interface Issue {
		readonly templateUid: string;
		readonly path: Array<string | number>;
	}
}

/** Item-local paths shared by form feedback and repository write admission. */
export const readTemplateReferenceIssuesFn = (
	item: ItemSchema.Type,
	templates: ReadonlyArray<TemplateSchema.Type> = [],
): ReadonlyArray<readTemplateReferenceIssuesFn.Issue> => {
	const issues: readTemplateReferenceIssuesFn.Issue[] = [];
	for (const entry of readItemOutcomeEntriesFn({
		itemUid: item.uid,
		item,
	}))
		for (const [setIndex, set] of entry.outcome.set.entries())
			for (const [rollIndex, roll] of set.roll.entries())
				for (const [outcomeIndex, outcome] of roll.outcome.entries()) {
					if (
						outcome.type !== "template" ||
						templates.some(({ uid }) => uid === outcome.templateUid)
					)
						continue;
					issues.push({
						templateUid: outcome.templateUid,
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
	return issues;
};
