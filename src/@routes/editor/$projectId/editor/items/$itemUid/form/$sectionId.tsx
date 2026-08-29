import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { parseEditorItemSectionIdFx } from "~/@routes/editor/$projectId/editor/items/$itemUid/-parseEditorItemSectionIdFx";
import { EditorItemArtworkSection } from "~/ui/item/editor/EditorItemArtworkSection";
import { EditorItemChargesSection } from "~/ui/item/editor/EditorItemChargesSection";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorItemIdentitySection } from "~/ui/item/editor/EditorItemIdentitySection";
import { EditorItemMergesSection } from "~/ui/item/editor/EditorItemMergesSection";
import { EditorItemProductionSection } from "~/ui/item/editor/EditorItemProductionSection";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorSpaceActionSection } from "~/ui/item/editor/EditorSpaceActionSection";
import { readEditorItemFormSectionsFn } from "~/ui/item/editor/fn/readEditorItemFormSectionsFn";

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
		const section = sectionId as EditorItemSectionId;
		const session = useEditorItemFormSession();
		const available = readEditorItemFormSectionsFn(session.initialItem).some(
			(candidate) => candidate.id === section,
		);
		if (!available)
			return (
				<section
					className="grid gap-2 py-8 text-center"
					data-ui="EditorItemSectionUnavailable"
				>
					<h2 className="text-lg font-semibold">Section unavailable</h2>
					<p className="text-sm text-muted">
						This item type does not use the {section} section.
					</p>
				</section>
			);
		switch (section) {
			case "identity":
				return <EditorItemIdentitySection />;
			case "artwork":
				return <EditorItemArtworkSection />;
			case "charges":
				return <EditorItemChargesSection />;
			case "merges":
				return <EditorItemMergesSection />;
			case "action":
				return <EditorSpaceActionSection />;
			case "production":
				return <EditorItemProductionSection />;
		}
	},
});
