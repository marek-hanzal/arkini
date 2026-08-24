import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";
import type { ItemDetailHeaderIdentityRenderProps } from "~/ui/item-detail/ItemDetailHeader";

/** Adds editor navigation around the shared gameplay Item Detail identity. */
export const EditorBoardItemDetailLink = ({
	children,
	disabled,
	itemId,
}: ItemDetailHeaderIdentityRenderProps) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined) return children;
	return (
		<ButtonLink
			aria-disabled={disabled}
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid: item.uid,
				sectionId: "identity",
			}}
			className="group min-h-0 min-w-0 justify-start gap-2 border-0 bg-transparent p-1 text-left shadow-none hover:bg-surface/70"
			data-ui="EditorBoardItemDetailLink"
		>
			{children}
			<span className="icon-[lucide--arrow-up-right] size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
		</ButtonLink>
	);
};
