import { ClockSection } from "~/item-authoring/ui/ClockSection";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { ArtworkSection } from "~/item-authoring/ui/ArtworkSection";
import { UnitsSection } from "~/item-authoring/ui/UnitsSection";
import { IdentitySection } from "~/item-authoring/ui/IdentitySection";
import { MergesSection } from "~/item-authoring/ui/MergesSection";
import { ProductionSection } from "~/item-authoring/ui/ProductionSection";
import { type SectionId } from "~/item-authoring/type/Section";
import { ActionSection } from "~/item-authoring/ui/ActionSection";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	beforeLoad: ({ params }) => {
		if (readSectionsFn("form").some((section) => section.id === params.sectionId)) return;
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
		switch (section) {
			case "identity":
				return <IdentitySection />;
			case "artwork":
				return <ArtworkSection />;
			case "units":
				return <UnitsSection />;
			case "merges":
				return <MergesSection />;
			case "action":
				return <ActionSection />;
			case "clock":
				return <ClockSection />;
			case "production":
				return <ProductionSection />;
		}
	},
});
