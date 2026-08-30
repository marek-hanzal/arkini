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
	const [workspace, setWorkspace] = useState<EditorWorkspaceId>();

	useEffect(() => {
		const unsubscribeBeforeNavigate = router.subscribe("onBeforeNavigate", ({ toLocation }) =>
			flushSync(() =>
				setWorkspace(readWorkspaceFromPathnameFn(toLocation.pathname, projectId)),
			),
		);
		const unsubscribeResolved = router.subscribe("onResolved", () => setWorkspace(undefined));
		return () => {
			unsubscribeBeforeNavigate();
			unsubscribeResolved();
		};
	}, [
		projectId,
		router,
	]);

	return {
		workspace,
	};
};
