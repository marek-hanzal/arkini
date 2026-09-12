import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { Detail } from "~/item-authoring/ui/Detail";
import type { DetailSectionId } from "~/item-authoring/type/Section";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail")({
	component: () => {
		const { itemUid } = Route.useParams();
		const params = useParams({
			strict: false,
		});
		const sectionId = (
			typeof params.sectionId === "string" ? params.sectionId : "identity"
		) as DetailSectionId;
		return (
			<Detail
				sectionId={sectionId}
				uid={itemUid}
			>
				<Outlet />
			</Detail>
		);
	},
});
