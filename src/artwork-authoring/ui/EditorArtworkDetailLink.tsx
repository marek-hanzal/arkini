import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { ButtonLink } from "~/ui/ui/Button";

/** Opens one artwork while preserving an Artwork-list search scoped to that resource. */
export const EditorArtworkDetailLink = ({
	children,
	className,
	resourceUid,
	filter = "all",
	query = resourceUid,
}: PropsWithChildren<{
	readonly className?: string;
	readonly resourceUid: string;
	readonly filter?: ArtworkCatalogFilterSchema.Type;
	readonly query?: string;
}>) => {
	const project = useEditorProject();
	return (
		<ButtonLink
			to="/editor/$projectId/artwork/$resourceUid/detail/overview"
			params={{
				projectId: project.projectId,
				resourceUid,
			}}
			search={{
				filter,
				query,
			}}
			className={twMerge(
				"min-h-0 border-0 bg-transparent p-0 text-left font-normal text-accent shadow-none hover:bg-transparent hover:text-accent-hover",
				className,
			)}
			title={`Open artwork ${resourceUid}`}
		>
			{children}
		</ButtonLink>
	);
};
