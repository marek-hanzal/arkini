import { useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";

import { EditorWorkspaceRoutes } from "~/authoring-shell/ui/useEditorActiveWorkspace";

export namespace useEditorWorkspaceShortcuts {
	export interface Props {
		readonly enabled: boolean;
		readonly projectId: string;
	}
}

/** Owns the stable workspace shortcut map and its navigation policy. */
export const useEditorWorkspaceShortcuts = ({
	enabled,
	projectId,
}: useEditorWorkspaceShortcuts.Props) => {
	const router = useRouter();
	useHotkeys(
		EditorWorkspaceRoutes.map(({ shortcut, to }) => ({
			hotkey: shortcut,
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
