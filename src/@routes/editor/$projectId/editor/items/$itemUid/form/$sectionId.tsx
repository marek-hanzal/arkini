import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";
import { parseEditorItemSectionIdFx } from "~/ui/item/editor/parseEditorItemSectionIdFx";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	beforeLoad: ({ params }) => {
		const section = RendererRuntime.runSync(
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
	return <EditorItemSectionPage section={sectionId as EditorItemSectionId} />;
}
