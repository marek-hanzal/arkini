import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorMcp } from "~/ui/editor-mcp/EditorMcp";
import { type EditorMcpSectionId, EditorMcpSectionIds } from "~/ui/editor-mcp/EditorMcpSections";

export const Route = createFileRoute("/editor/$projectId/mcp/$sectionId")({
	beforeLoad: ({ params }) => {
		if (EditorMcpSectionIds.some((section) => section === params.sectionId)) return;
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
