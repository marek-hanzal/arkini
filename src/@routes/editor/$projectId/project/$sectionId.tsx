import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { parseEditorProjectSectionIdFx } from "~/@routes/editor/$projectId/project/-parseEditorProjectSectionIdFx";
import { EditorProjectAppearanceSection } from "~/ui/project/editor/EditorProjectAppearanceSection";
import { EditorProjectBoardSection } from "~/ui/project/editor/EditorProjectBoardSection";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import { EditorProjectInventorySection } from "~/ui/project/editor/EditorProjectInventorySection";
import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";
import { EditorProjectToolbarSection } from "~/ui/project/editor/EditorProjectToolbarSection";

interface EditorProjectSectionSearch {
	readonly avatar?: number;
}

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	validateSearch: (search): EditorProjectSectionSearch => {
		const avatar = typeof search.avatar === "number" ? search.avatar : Number.NaN;
		return Number.isInteger(avatar) && avatar >= 0
			? {
					avatar,
				}
			: {};
	},
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
	component: () => {
		const { sectionId } = Route.useParams();
		const { avatar } = Route.useSearch();
		switch (sectionId as EditorProjectSectionId) {
			case "general":
				return <EditorProjectGeneralSection />;
			case "appearance":
				return <EditorProjectAppearanceSection initialAvatarIndex={avatar ?? 0} />;
			case "board":
				return <EditorProjectBoardSection />;
			case "toolbar":
				return <EditorProjectToolbarSection />;
			case "inventory":
				return <EditorProjectInventorySection />;
		}
	},
});
