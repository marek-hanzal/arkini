import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { parseEditorItemSectionIdFx } from "~/@routes/editor/$projectId/editor/items/$itemUid/-parseEditorItemSectionIdFx";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemSectionPage } from "~/ui/item/editor/EditorItemSectionPage";

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
	component: () => {
		const { sectionId } = Route.useParams();
		return <EditorItemSectionPage section={sectionId as EditorItemSectionId} />;
	},
});
