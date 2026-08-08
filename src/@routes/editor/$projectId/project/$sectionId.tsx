import { createFileRoute } from "@tanstack/react-router";

import { EditorProjectSectionPage } from "~/ui/project/editor/EditorProjectSectionPage";
import { parseEditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	component: EditorProjectSectionRoute,
});

function EditorProjectSectionRoute() {
	const { sectionId } = Route.useParams();
	return <EditorProjectSectionPage section={parseEditorProjectSectionId(sectionId)} />;
}
