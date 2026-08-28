import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

type EditorItemOptionalCapability = "charges" | "merges";

interface EditorItemFormSearch {
	readonly enable?: EditorItemOptionalCapability;
	readonly itemType?: TypeSchema.Type;
	readonly lineId?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form")({
	validateSearch: (search): EditorItemFormSearch => ({
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
	}),
	component: () => {
		const { itemUid } = Route.useParams();
		const { enable, itemType, lineId } = Route.useSearch();
		const params = useParams({
			strict: false,
		});
		const sectionId = (
			typeof params.sectionId === "string" ? params.sectionId : "identity"
		) as EditorItemSectionId;
		return (
			<EditorItemForm
				enableCapability={enable}
				itemType={itemType}
				productionLineId={lineId}
				sectionId={sectionId}
				uid={itemUid}
			>
				<Outlet />
			</EditorItemForm>
		);
	},
});
