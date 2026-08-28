import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { parseEditorMcpSectionIdFx } from "~/@routes/editor/$projectId/mcp/-parseEditorMcpSectionIdFx";
import { EditorMcp } from "~/ui/editor-mcp/EditorMcp";
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
	component: () => {
		const { sectionId } = Route.useParams();
		return <EditorMcp section={sectionId as EditorMcpSectionId} />;
	},
});
