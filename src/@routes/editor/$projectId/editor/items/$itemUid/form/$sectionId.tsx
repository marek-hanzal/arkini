import { match } from "ts-pattern";
import { ClockSection } from "~/item-authoring/ui/ClockSection";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { ArtworkSection } from "~/item-authoring/ui/ArtworkSection";
import { UnitsSection } from "~/item-authoring/ui/UnitsSection";
import { IdentitySection } from "~/item-authoring/ui/IdentitySection";
import { MergesSection } from "~/item-authoring/ui/MergesSection";
import { ProductionSection } from "~/item-authoring/ui/ProductionSection";
import { type SectionId } from "~/item-authoring/type/Section";
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
		return match(section)
			.with("identity", () => {
				return <IdentitySection />;
			})
			.with("artwork", () => {
				return <ArtworkSection />;
			})
			.with("units", () => {
				return <UnitsSection />;
			})
			.with("merges", () => {
				return <MergesSection />;
			})
			.with("clock", () => {
				return <ClockSection />;
			})
			.with("production", () => {
				return <ProductionSection />;
			})
			.otherwise(() => undefined);
	},
});
