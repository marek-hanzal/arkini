import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";

/** Shared authoring labels and searchable identities for outcome sets and rolls. */
export const readOutcomeCollectionSummaryFn = ({
	outcomes,
	templates,
	readItemLabelFn,
	textFn,
}: {
	readonly outcomes: readonly OutcomeSchema.Type[];
	readonly templates: readonly TemplateSchema.Type[] | undefined;
	readonly readItemLabelFn: (itemUid: string, fallback: string) => string;
	readonly textFn: (key: string) => string;
}) => {
	const entries = outcomes.map((outcome) => {
		switch (outcome.type) {
			case "item":
				return {
					label: readItemLabelFn(outcome.itemUid, textFn("No item selected")),
					searchTerms: [
						outcome.itemUid,
						readItemLabelFn(outcome.itemUid, ""),
					],
				};
			case "template": {
				const title = templates?.find(({ uid }) => uid === outcome.templateUid)?.title;
				return {
					label: title ?? textFn("No template selected"),
					searchTerms: [
						outcome.templateUid,
						`Template ${title ?? outcome.templateUid}`,
					],
				};
			}
			case "space":
				return {
					label: `${textFn("Space")} ${outcome.space}`,
					searchTerms: [
						`Space ${outcome.space}`,
					],
				};
		}
	});
	return {
		label: entries.map(({ label }) => label).join(", "),
		searchTerms: entries.flatMap(({ searchTerms }) => searchTerms),
	};
};
