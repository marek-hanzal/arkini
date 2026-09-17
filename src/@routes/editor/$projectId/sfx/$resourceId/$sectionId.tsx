import { createFileRoute, redirect } from "@tanstack/react-router";
import { EditorAudioResourceDetail } from "~/audio-authoring/ui/EditorAudioResourceDetail";
export const Route = createFileRoute("/editor/$projectId/sfx/$resourceId/$sectionId")({
	beforeLoad: ({ params }) => {
		if (
			![
				"view",
				"edit",
				"delete",
			].includes(params.sectionId)
		)
			throw redirect({
				to: "/editor/$projectId/sfx/$resourceId/$sectionId",
				params: {
					...params,
					sectionId: "view",
				},
				replace: true,
			});
	},
	component: () => {
		const { resourceId, sectionId } = Route.useParams();
		return (
			<EditorAudioResourceDetail
				key={`${resourceId}:${sectionId}`}
				type="sfx"
				resourceId={resourceId}
				section={sectionId === "edit" ? "edit" : sectionId === "delete" ? "delete" : "view"}
			/>
		);
	},
});
