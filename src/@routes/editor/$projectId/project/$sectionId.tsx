import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { EditorProjectSectionRoutePage } from "~/page/editor/EditorProjectSectionRoutePage";
import {
	type EditorProjectSectionId,
	parseEditorProjectSectionIdFx,
} from "~/page/editor/parseEditorProjectSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	beforeLoad: ({ context, params }) => {
		const section = context.rendererRuntime.runSync(
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
	return <EditorProjectSectionRoutePage section={sectionId as EditorProjectSectionId} />;
}
