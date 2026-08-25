import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";

import { EditorProjectSectionRoutePage } from "~/page/editor/EditorProjectSectionRoutePage";
import {
	type EditorProjectSectionId,
	parseEditorProjectSectionIdFx,
} from "~/page/editor/parseEditorProjectSectionIdFx";

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
	component: EditorProjectSectionRoute,
});

function EditorProjectSectionRoute() {
	const { sectionId } = Route.useParams();
	const { avatar } = Route.useSearch();
	return (
		<EditorProjectSectionRoutePage
			avatarIndex={avatar}
			section={sectionId as EditorProjectSectionId}
		/>
	);
}
