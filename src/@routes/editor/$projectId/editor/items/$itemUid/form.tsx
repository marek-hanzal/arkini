import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { Form } from "~/item-authoring/ui/Form";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";

interface EditorItemFormSearch {
	readonly defaultDraft?: boolean;
	readonly defaultTitle?: string;
	readonly enable?: OptionalCapability;
	readonly create?: boolean;
	readonly lineUid?: string;
	readonly input?: number;
	readonly rule?: number;
	readonly when?: number;
	readonly merge?: number;
	readonly outcomeSet?: number;
	readonly outcomeRoll?: number;
	readonly outcomeIndex?: number;
	readonly resourceUid?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => {
		const input = typeof search.input === "number" ? search.input : Number.NaN;
		const rule = typeof search.rule === "number" ? search.rule : Number.NaN;
		const when = typeof search.when === "number" ? search.when : Number.NaN;
		const merge = typeof search.merge === "number" ? search.merge : Number.NaN;
		const outcomeSet = typeof search.outcomeSet === "number" ? search.outcomeSet : Number.NaN;
		const outcomeRoll =
			typeof search.outcomeRoll === "number" ? search.outcomeRoll : Number.NaN;
		const outcomeIndex =
			typeof search.outcomeIndex === "number" ? search.outcomeIndex : Number.NaN;
		return {
			...(Number.isInteger(when) && when >= 0
				? {
						when,
					}
				: {}),
			...(Number.isInteger(rule) && rule >= 0
				? {
						rule,
					}
				: {}),
			...(Number.isInteger(input) && input >= 0
				? {
						input,
					}
				: {}),
			...(Number.isInteger(outcomeIndex) && outcomeIndex >= 0
				? {
						outcomeIndex,
					}
				: {}),
			...(Number.isInteger(outcomeSet) && outcomeSet >= 0
				? {
						outcomeSet,
					}
				: {}),
			...(Number.isInteger(outcomeRoll) && outcomeRoll >= 0
				? {
						outcomeRoll,
					}
				: {}),
			...(typeof search.defaultDraft === "boolean"
				? {
						defaultDraft: search.defaultDraft,
					}
				: {}),
			...(typeof search.defaultTitle === "string" && search.defaultTitle.length > 0
				? {
						defaultTitle: search.defaultTitle,
					}
				: {}),
			...(search.enable === "units" ||
			search.enable === "merges" ||
			search.enable === "clock" ||
			search.enable === "production"
				? {
						enable: search.enable,
					}
				: {}),
			...(search.create === true
				? {
						create: true as const,
					}
				: {}),
			...(typeof search.lineUid === "string" && search.lineUid.length > 0
				? {
						lineUid: search.lineUid,
					}
				: {}),
			...(Number.isInteger(merge) && merge >= 0
				? {
						merge,
					}
				: {}),
			...(typeof search.resourceUid === "string" && search.resourceUid.length > 0
				? {
						resourceUid: search.resourceUid,
					}
				: {}),
		};
	},
	component: () => {
		const { itemUid } = Route.useParams();
		const {
			defaultDraft,
			defaultTitle,
			enable,
			create,
			lineUid,
			input,
			rule,
			when,
			merge,
			outcomeSet,
			outcomeRoll,
			outcomeIndex,
			resourceUid,
		} = Route.useSearch();
		const params = useParams({
			strict: false,
		});
		const sectionId = (
			typeof params.sectionId === "string" ? params.sectionId : "identity"
		) as SectionId;
		return (
			<Form
				defaultDraft={defaultDraft}
				defaultTitle={defaultTitle}
				enableCapability={enable}
				create={create}
				inputIndex={input}
				ruleIndex={rule}
				whenIndex={when}
				mergeIndex={merge}
				outcomeSetIndex={outcomeSet}
				outcomeRollIndex={outcomeRoll}
				outcomeIndex={outcomeIndex}
				productionLineUid={lineUid}
				resourceUid={resourceUid}
				sectionId={sectionId}
				uid={itemUid}
			>
				<Outlet />
			</Form>
		);
	},
});
