import { readSpaceDestinationLabelFn } from "~/space/fn/readSpaceDestinationLabelFn";
import { match } from "ts-pattern";
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
		return match(outcome)
			.with(
				{
					type: "item",
				},
				(outcome) => {
					return {
						label: readItemLabelFn(outcome.itemUid, textFn("No item selected")),
						searchTerms: [
							outcome.itemUid,
							readItemLabelFn(outcome.itemUid, ""),
						],
					};
				},
			)
			.with(
				{
					type: "template",
				},
				(outcome) => {
					const title = templates?.find(({ uid }) => uid === outcome.templateUid)?.title;
					const target =
						outcome.space === undefined ? "" : ` · ${textFn("Space")} ${outcome.space}`;
					return {
						label: `${title ?? textFn("No template selected")}${target}`,
						searchTerms: [
							outcome.templateUid,
							`Template ${title ?? outcome.templateUid}`,
							...(outcome.space === undefined
								? []
								: [
										`Space ${outcome.space}`,
									]),
						],
					};
				},
			)
			.with(
				{
					type: "space",
				},
				(outcome) => {
					return {
						label: readSpaceDestinationLabelFn(outcome.space, textFn, templates),
						searchTerms: [
							readSpaceDestinationLabelFn(outcome.space, (key) => key, templates),
							...(typeof outcome.space === "object"
								? [
										outcome.space.templateUid,
									]
								: []),
						],
					};
				},
			)
			.exhaustive();
	});
	return {
		label: entries.map(({ label }) => label).join(", "),
		searchTerms: entries.flatMap(({ searchTerms }) => searchTerms),
	};
};
