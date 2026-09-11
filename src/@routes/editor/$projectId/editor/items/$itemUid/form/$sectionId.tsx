import { createFileRoute, redirect } from "@tanstack/react-router";

import { ArtworkSection } from "~/item-authoring/ui/ArtworkSection";
import { ChargesSection } from "~/item-authoring/ui/ChargesSection";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { IdentitySection } from "~/item-authoring/ui/IdentitySection";
import { MergesSection } from "~/item-authoring/ui/MergesSection";
import { ProductionSection } from "~/item-authoring/ui/ProductionSection";
import { type SectionId, SectionIds } from "~/item-authoring/type/Section";
import { SpaceActionSection } from "~/item-authoring/ui/SpaceActionSection";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	beforeLoad: ({ params }) => {
		if (SectionIds.some((section) => section === params.sectionId)) return;
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
		const section = sectionId as SectionId;
		const session = useFormSession();
		const available = readSectionsFn(session.initialItem, "form").some(
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
				return <IdentitySection />;
			case "artwork":
				return <ArtworkSection />;
			case "charges":
				return <ChargesSection />;
			case "merges":
				return <MergesSection />;
			case "action":
				return <SpaceActionSection />;
			case "production":
				return <ProductionSection />;
		}
	},
});
