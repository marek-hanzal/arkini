import { useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";

import { readEditorWorkspaceShortcut } from "~/ui/editor/EditorWorkspaceShortcuts";
import { EditorWorkspaceRoutes } from "~/ui/editor/useEditorActiveWorkspace";

export namespace useEditorWorkspaceShortcuts {
	export interface Props {
		readonly enabled: boolean;
		readonly projectId: string;
	}
}

/** Owns the editor-wide workspace shortcut namespace and routed navigation. */
export const useEditorWorkspaceShortcuts = ({
	enabled,
	projectId,
}: useEditorWorkspaceShortcuts.Props) => {
	const router = useRouter();

	useHotkeys(
		EditorWorkspaceRoutes.map(({ id, to }) => ({
			hotkey: readEditorWorkspaceShortcut(id),
			callback: (event) => {
				if (event.repeat) return;
				void router.navigate({
					to,
					params: {
						projectId,
					},
				});
			},
		})),
		{
			enabled,
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
		},
	);
};
