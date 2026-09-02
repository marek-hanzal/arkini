import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { Form } from "~/item-authoring/ui/Form";
import type { SectionId } from "~/item-authoring/type/Section";

type OptionalCapability = "charges" | "merges";

interface EditorItemFormSearch {
	readonly enable?: OptionalCapability;
	readonly itemType?: TypeSchema.Type;
	readonly lineId?: string;
	readonly merge?: number;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => {
		const merge = typeof search.merge === "number" ? search.merge : Number.NaN;
		return {
			...(search.enable === "charges" || search.enable === "merges"
				? {
						enable: search.enable,
					}
				: {}),
			...(search.itemType === undefined
				? {}
				: {
						itemType: TypeSchema.parse(search.itemType),
					}),
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
		};
	},
	component: () => {
		const { itemUid } = Route.useParams();
		const { enable, itemType, lineId, merge } = Route.useSearch();
		const params = useParams({
			strict: false,
		});
		const sectionId = (
			typeof params.sectionId === "string" ? params.sectionId : "identity"
		) as SectionId;
		return (
			<Form
				enableCapability={enable}
				itemType={itemType}
				mergeIndex={merge}
				productionLineId={lineId}
				sectionId={sectionId}
				uid={itemUid}
			>
				<Outlet />
			</Form>
		);
	},
});
