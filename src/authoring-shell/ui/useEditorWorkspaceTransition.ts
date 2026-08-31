import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import {
	EditorWorkspaceRoutes,
	type EditorWorkspaceId,
} from "~/authoring-shell/ui/useEditorActiveWorkspace";

const readWorkspaceFromPathnameFn = (
	pathname: string,
	projectId: string,
): EditorWorkspaceId | undefined =>
	EditorWorkspaceRoutes.find(({ matchTo }) => {
		const workspacePath = matchTo.replace("$projectId", projectId);
		return pathname === workspacePath || pathname.startsWith(`${workspacePath}/`);
	})?.id;

export namespace useEditorWorkspaceTransition {
	export interface Props {
		readonly projectId: string;
	}

	export interface Output {
		readonly workspace: EditorWorkspaceId | undefined;
	}
}

/** Projects the latest accepted router destination while its workspace is resolving. */
export const useEditorWorkspaceTransition = ({
	projectId,
}: useEditorWorkspaceTransition.Props): useEditorWorkspaceTransition.Output => {
	const router = useRouter();
	const [workspace, setWorkspaceFn] = useState<EditorWorkspaceId>();

	useEffect(() => {
		const unsubscribeBeforeNavigateFn = router.subscribe("onBeforeNavigate", ({ toLocation }) =>
			flushSync(() =>
				setWorkspaceFn(readWorkspaceFromPathnameFn(toLocation.pathname, projectId)),
			),
		);
		const unsubscribeResolvedFn = router.subscribe("onResolved", () =>
			setWorkspaceFn(undefined),
		);
		return () => {
			unsubscribeBeforeNavigateFn();
			unsubscribeResolvedFn();
		};
	}, [
		projectId,
		router,
	]);

	return {
		workspace,
	};
};
