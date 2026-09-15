import { useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";

import { ProjectSections } from "~/project-authoring/type/ProjectSections";

export namespace useProjectDetailSectionShortcuts {
	export interface Props {
		readonly projectId: string;
	}
}

/** Owns the unmodified section keys on Project Detail while Edit keeps E. */
export const useProjectDetailSectionShortcuts = ({
	projectId,
}: useProjectDetailSectionShortcuts.Props) => {
	const router = useRouter();
	useHotkeys(
		ProjectSections.map((section) => ({
			hotkey: {
				key: section.shortcut,
			},
			callback: (event: KeyboardEvent) => {
				if (event.repeat || event.isComposing) return;
				void router.navigate({
					to: "/editor/$projectId/project/detail/$sectionId",
					params: {
						projectId,
						sectionId: section.id,
					},
				});
			},
		})),
		{
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
		},
	);
};
