import { useEditorSectionShortcuts } from "~/authoring-shell/ui/useEditorSectionShortcuts";
import { useRouter } from "@tanstack/react-router";

import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { EditorArtworkDetailSections } from "~/artwork-authoring/type/EditorArtworkDetailSections";

export namespace useEditorArtworkDetailSectionShortcuts {
	export interface Props {
		readonly enabled: boolean;
		readonly filter: ArtworkCatalogFilterSchema.Type;
		readonly projectId: string;
		readonly query: string;
		readonly resourceId: string;
	}
}

/** Owns the unmodified section keys on Artwork Detail while Edit keeps E. */
export const useEditorArtworkDetailSectionShortcuts = ({
	enabled,
	filter,
	projectId,
	query,
	resourceId,
}: useEditorArtworkDetailSectionShortcuts.Props) => {
	const router = useRouter();
	useEditorSectionShortcuts({
		enabled,
		options: EditorArtworkDetailSections,
		onSelectFn: (section) => {
			void router.navigate({
				to: section.to,
				params: {
					projectId,
					resourceId,
				},
				search: {
					filter,
					query,
				},
			});
		},
	});
};
