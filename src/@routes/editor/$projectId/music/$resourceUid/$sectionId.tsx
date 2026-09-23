import { createFileRoute, redirect } from "@tanstack/react-router";
import { EditorAudioResourceDetail } from "~/audio-authoring/ui/EditorAudioResourceDetail";
export const Route = createFileRoute("/editor/$projectId/music/$resourceUid/$sectionId")({
	beforeLoad: ({ params }) => {
		if (
			![
				"view",
				"edit",
				"delete",
			].includes(params.sectionId)
		)
			throw redirect({
				to: "/editor/$projectId/music/$resourceUid/$sectionId",
				params: {
					...params,
					sectionId: "view",
				},
				replace: true,
			});
	},
	component: () => {
		const { resourceUid, sectionId } = Route.useParams();
		return (
			<EditorAudioResourceDetail
				key={`${resourceUid}:${sectionId}`}
				type="music"
				resourceUid={resourceUid}
				section={sectionId === "edit" ? "edit" : sectionId === "delete" ? "delete" : "view"}
			/>
		);
	},
});
