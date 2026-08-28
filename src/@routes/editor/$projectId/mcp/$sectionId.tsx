import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { EditorMcpPage } from "~/page/editor/EditorMcpPage";
import { parseEditorMcpSectionIdFx } from "~/page/editor/parseEditorMcpSectionIdFx";
import type { EditorMcpSectionId } from "~/ui/editor-mcp/EditorMcpSections";

export const Route = createFileRoute("/editor/$projectId/mcp/$sectionId")({
	beforeLoad: ({ context, params }) => {
		const section = context.rendererRuntime.runSync(
			parseEditorMcpSectionIdFx(params.sectionId).pipe(Effect.option),
		);
		if (Option.isSome(section)) return;
		throw redirect({
			to: "/editor/$projectId/mcp/$sectionId",
			params: {
				...params,
				sectionId: "server",
			},
			replace: true,
		});
	},
	component: EditorMcpSectionRoute,
});

function EditorMcpSectionRoute() {
	const { sectionId } = Route.useParams();
	return <EditorMcpPage section={sectionId as EditorMcpSectionId} />;
}
