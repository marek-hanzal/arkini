import { ArrowUpRight } from "lucide-react";
import type { ComponentProps } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";
import type { ItemDetailHeaderIdentityRenderer } from "~/item-detail-frame/ui/ItemDetailHeader";

/** Adds editor navigation around the shared gameplay Item Detail identity. */
export const EditorBoardItemDetailLink = ({
	children,
	disabled,
	itemId,
}: ComponentProps<ItemDetailHeaderIdentityRenderer>) => {
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
			className="group min-h-0 min-w-0 justify-start gap-2 rounded-none border-0 bg-transparent p-0 text-left font-normal shadow-none hover:border-transparent hover:bg-transparent active:bg-transparent [&_h2]:decoration-accent/55 [&_h2]:underline-offset-4 [&_h2]:transition-colors hover:[&_h2]:text-accent hover:[&_h2]:underline"
			data-ui="EditorBoardItemDetailLink"
		>
			{children}
			<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
		</ButtonLink>
	);
};
