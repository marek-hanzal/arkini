import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorMcp } from "~/authoring-mcp/ui/EditorMcp";
import { type EditorMcpSectionId, EditorMcpSections } from "~/authoring-mcp/ui/EditorMcpSections";

export const Route = createFileRoute("/editor/$projectId/mcp/$sectionId")({
	beforeLoad: ({ params }) => {
		if (EditorMcpSections.some((section) => section.id === params.sectionId)) return;
		throw redirect({
			to: "/editor/$projectId/mcp/$sectionId",
			params: {
				...params,
				sectionId: "server",
			},
			replace: true,
		});
	},
	component: () => {
		const { sectionId } = Route.useParams();
		return <EditorMcp section={sectionId as EditorMcpSectionId} />;
	},
});
