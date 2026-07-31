import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { parseEditorItemType } from "~/bridge/editor/EditorItemModel";
import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";

export const Route = createFileRoute("/editor/$projectId/editor/new/$itemType")({
	validateSearch: (search: Record<string, unknown>) => ({
		draft:
			typeof search.draft === "string" && search.draft.length > 0 ? search.draft : undefined,
	}),
	loader: ({ params }) => parseEditorItemType(params.itemType),
	component: EditorNewItemTypeRoute,
});

function EditorNewItemTypeRoute() {
	const itemType = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const generatedDraft = useRef(crypto.randomUUID()).current;
	const draft = search.draft ?? generatedDraft;
	useEffect(() => {
		if (search.draft !== undefined) return;
		void navigate({
			search: {
				draft,
			},
			replace: true,
		});
	}, [
		draft,
		navigate,
		search.draft,
	]);
	return (
		<EditorItemFormPage
			draftId={draft}
			mode="create"
			itemType={itemType}
		/>
	);
}
