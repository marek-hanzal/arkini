import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { Form } from "~/item-authoring/ui/Form";
import type { SectionId } from "~/item-authoring/type/Section";

type OptionalCapability = "units" | "merges";

interface EditorItemFormSearch {
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly enable?: OptionalCapability;
	readonly create?: boolean;
	readonly lineId?: string;
	readonly merge?: number;
	readonly resourceId?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => {
		const merge = typeof search.merge === "number" ? search.merge : Number.NaN;
		return {
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
			...(search.enable === "units" || search.enable === "merges"
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
			merge,
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
				mergeIndex={merge}
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
