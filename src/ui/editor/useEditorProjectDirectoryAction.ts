import { useAtom } from "@effect/atom-react";
import { useCallback } from "react";

import { openEditorDirectoryAtom } from "~/bridge/editor/openEditorDirectoryAtom";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

/** Exposes the exact project-directory command result without duplicating its async state. */
export const useEditorProjectDirectoryAction = (projectId: string) => {
	const [result, openDirectory] = useAtom(openEditorDirectoryAtom);
	const pending = result.waiting;
	const error = readSettledAsyncResultError(result);
	const open = useCallback(() => {
		if (pending) return;
		openDirectory(projectId);
	}, [
		openDirectory,
		pending,
		projectId,
	]);
	return {
		error,
		open,
		pending,
	};
};
