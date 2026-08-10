import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { EditorItemFormSectionPage } from "~/page/editor/EditorItemFormSectionPage";
import {
	type EditorItemSectionId,
	parseEditorItemSectionIdFx,
} from "~/page/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	beforeLoad: ({ context, params }) => {
		const section = context.rendererRuntime.runSync(
			parseEditorItemSectionIdFx(params.sectionId).pipe(Effect.option),
		);
		if (Option.isSome(section)) return;
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			params: {
				...params,
				sectionId: "identity",
			},
			search: true,
			replace: true,
		});
	},
	component: EditorItemFormSectionRoute,
});

function EditorItemFormSectionRoute() {
	const { sectionId } = Route.useParams();
	return <EditorItemFormSectionPage section={sectionId as EditorItemSectionId} />;
}
