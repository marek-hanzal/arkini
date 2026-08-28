import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { EditorItemDetailSectionPage } from "~/page/editor/EditorItemDetailSectionPage";
import {
	type EditorItemSectionId,
	parseEditorItemSectionIdFx,
} from "~/page/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	beforeLoad: ({ context, params }) => {
		const section = context.rendererRuntime.runSync(
			parseEditorItemSectionIdFx(params.sectionId).pipe(Effect.option),
		);
		if (Option.isSome(section)) return;
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				...params,
				sectionId: "identity",
			},
			replace: true,
		});
	},
	component: EditorItemDetailSectionRoute,
});

function EditorItemDetailSectionRoute() {
	const { itemUid, sectionId } = Route.useParams();
	return (
		<EditorItemDetailSectionPage
			sectionId={sectionId as EditorItemSectionId}
			uid={itemUid}
		/>
	);
}
