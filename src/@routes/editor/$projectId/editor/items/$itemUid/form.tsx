import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { Form } from "~/item-authoring/ui/Form";
import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";

interface EditorItemFormSearch {
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly enable?: OptionalCapability;
	readonly create?: boolean;
	readonly lineId?: string;
	readonly input?: number;
	readonly rule?: number;
	readonly when?: number;
	readonly merge?: number;
	readonly outputSet?: number;
	readonly outputRoll?: number;
	readonly outputDrop?: number;
	readonly outputCandidate?: number;
	readonly resourceId?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => {
		const input = typeof search.input === "number" ? search.input : Number.NaN;
		const rule = typeof search.rule === "number" ? search.rule : Number.NaN;
		const when = typeof search.when === "number" ? search.when : Number.NaN;
		const merge = typeof search.merge === "number" ? search.merge : Number.NaN;
		const outputSet = typeof search.outputSet === "number" ? search.outputSet : Number.NaN;
		const outputRoll = typeof search.outputRoll === "number" ? search.outputRoll : Number.NaN;
		const outputDrop = typeof search.outputDrop === "number" ? search.outputDrop : Number.NaN;
		const outputCandidate =
			typeof search.outputCandidate === "number" ? search.outputCandidate : Number.NaN;
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
			...(Number.isInteger(outputDrop) && outputDrop >= 0
				? {
						outputDrop,
					}
				: {}),
			...(Number.isInteger(outputCandidate) && outputCandidate >= 0
				? {
						outputCandidate,
					}
				: {}),
			...(Number.isInteger(outputSet) && outputSet >= 0
				? {
						outputSet,
					}
				: {}),
			...(Number.isInteger(outputRoll) && outputRoll >= 0
				? {
						outputRoll,
					}
				: {}),
			...(typeof search.defaultDraft === "boolean"
				? {
						defaultDraft: search.defaultDraft,
					}
				: {}),
			...(typeof search.defaultItemId === "string" && search.defaultItemId.length > 0
				? {
						defaultItemId: search.defaultItemId,
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
			search.enable === "action" ||
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
			...(typeof search.lineId === "string" && search.lineId.length > 0
				? {
						lineId: search.lineId,
					}
				: {}),
			...(Number.isInteger(merge) && merge >= 0
				? {
						merge,
					}
				: {}),
			...(typeof search.resourceId === "string" && search.resourceId.length > 0
				? {
						resourceId: search.resourceId,
					}
				: {}),
		};
	},
	component: () => {
		const { itemUid } = Route.useParams();
		const {
			defaultDraft,
			defaultItemId,
			defaultTitle,
			enable,
			create,
			lineId,
			input,
			rule,
			when,
			merge,
			outputSet,
			outputRoll,
			outputDrop,
			outputCandidate,
			resourceId,
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
				defaultItemId={defaultItemId}
				defaultTitle={defaultTitle}
				enableCapability={enable}
				create={create}
				inputIndex={input}
				ruleIndex={rule}
				whenIndex={when}
				mergeIndex={merge}
				outputSetIndex={outputSet}
				outputRollIndex={outputRoll}
				outputDropIndex={outputDrop}
				outputCandidateIndex={outputCandidate}
				productionLineId={lineId}
				resourceId={resourceId}
				sectionId={sectionId}
				uid={itemUid}
			>
				<Outlet />
			</Form>
		);
	},
});
