import { ButtonLink } from "~/ui/ui/Button";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { SectionId } from "~/item-authoring/type/Section";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Links one known item reference to its canonical identity detail. */
export const DetailReference = ({
	itemId,
	sectionId = "identity",
	stretched = false,
}: {
	readonly itemId: string;
	readonly sectionId?: SectionId;
	readonly stretched?: boolean;
}) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined)
		return (
			<span className="min-w-0 break-all font-mono text-sm font-medium text-muted">
				{itemId} [missing]
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
			className={`group min-h-0 min-w-0 justify-start gap-3 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent${stretched ? " flex-1 before:absolute before:inset-0 before:content-['']" : ""}`}
		>
			<EditorItemThumbnail
				className="rounded-lg border-0 bg-surface/45 ring-1 ring-line/50"
				imageClassName="p-0.5"
				resourceIds={item.asset.default}
				size="sm"
			/>
			<span className="min-w-0">
				<span className="block truncate font-medium text-foreground transition-colors group-hover:text-accent">
					{item.title}
				</span>
				<span className="mt-0.5 block truncate font-mono text-xs font-normal text-muted transition-colors group-hover:text-accent">
					{item.id}
				</span>
			</span>
		</ButtonLink>
	);
};
