import type { ReactNode } from "react";
import { ButtonLink } from "~/ui/ui/Button";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { SectionId } from "~/item-authoring/type/Section";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import { Tx } from "~/translation/ui/Tx";

/** Links one known item reference to the requested detail section. */
export const DetailReference = ({
	itemId,
	description,
	eyebrow,
	search = {},
	sectionId = "identity",
	stretched = false,
}: {
	readonly itemId: string;
	readonly description?: ReactNode;
	readonly eyebrow?: ReactNode;
	readonly search?: {
		readonly filter?: ItemConnectionFilter;
	};
	readonly sectionId?: SectionId;
	readonly stretched?: boolean;
}) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined)
		return (
			<span className="min-w-0 break-all font-mono text-sm font-medium text-muted">
				{eyebrow}
				{itemId} <Tx label="Missing item marker" />
			</span>
		);
	return (
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				itemUid: item.uid,
				projectId: project.projectId,
				sectionId,
			}}
			search={search}
			className={`group min-h-0 min-w-0 justify-start gap-3 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent${stretched ? " flex-1 before:absolute before:inset-0 before:content-['']" : ""}`}
		>
			<EditorItemThumbnail
				className="rounded-lg border-0 bg-surface/45 ring-1 ring-line/50"
				imageClassName="p-0.5"
				resourceIds={item.artwork.default}
				size="sm"
			/>
			<span className="min-w-0">
				{eyebrow}
				<span className="block truncate font-medium text-foreground transition-colors group-hover:text-accent">
					{item.title}
				</span>
				{description === undefined ? null : (
					<span className="mt-0.5 block whitespace-normal text-xs font-normal text-muted transition-colors group-hover:text-accent">
						{description}
					</span>
				)}
			</span>
		</ButtonLink>
	);
};
