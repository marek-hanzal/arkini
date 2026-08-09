import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { EditorProjectSectionPage } from "~/ui/project/editor/EditorProjectSectionPage";
import { parseEditorProjectSectionIdFx } from "~/ui/project/editor/parseEditorProjectSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	beforeLoad: ({ params }) => {
		const section = RendererRuntime.runSync(
			parseEditorProjectSectionIdFx(params.sectionId).pipe(Effect.option),
		);
		if (Option.isSome(section)) return;
		throw redirect({
			to: "/editor/$projectId/project/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			replace: true,
		});
	},
	component: EditorProjectSectionRoute,
});

function EditorProjectSectionRoute() {
	const { sectionId } = Route.useParams();
	return <EditorProjectSectionPage section={sectionId as EditorProjectSectionId} />;
}
