import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemDetailSectionPage } from "~/ui/item/editor/EditorItemDetailSectionPage";
import { parseEditorItemSectionIdFx } from "~/ui/item/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	beforeLoad: ({ params }) => {
		const section = RendererRuntime.runSync(
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
