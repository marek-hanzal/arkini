import { createFileRoute } from "@tanstack/react-router";

import { EditorProjectSectionPage } from "~/ui/project/editor/EditorProjectSectionPage";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { parseEditorProjectSectionIdFx } from "~/ui/project/editor/parseEditorProjectSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	component: EditorProjectSectionRoute,
});

function EditorProjectSectionRoute() {
	const { sectionId } = Route.useParams();
	return (
		<EditorProjectSectionPage
			section={RendererRuntime.runSync(parseEditorProjectSectionIdFx(sectionId))}
		/>
	);
}
