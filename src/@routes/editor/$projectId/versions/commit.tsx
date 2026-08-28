import { createFileRoute } from "@tanstack/react-router";

import { EditorVersionCommitPage } from "~/page/editor/EditorVersionCommitPage";

interface EditorVersionCommitSearch {
	readonly returnTo?: string;
}

export const Route = createFileRoute("/editor/$projectId/versions/commit")({
	validateSearch: (search): EditorVersionCommitSearch => ({
		returnTo:
			typeof search.returnTo === "string" && search.returnTo.startsWith("/editor/")
				? search.returnTo
				: undefined,
	}),
	component: EditorVersionCommitPage,
});
