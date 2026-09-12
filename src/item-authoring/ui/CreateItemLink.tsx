import { createId } from "@paralleldrive/cuid2";
import { useState, type ReactNode } from "react";
import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";

/** Carries explicit creation intent and its seed values into the item form. */
export const CreateItemLink = ({
	projectId,
	children,
	className,
	dataUi,
	defaultDraft,
	defaultItemId,
	defaultTitle,
	resourceId,
	variant = "default",
}: {
	readonly projectId: string;
	readonly children: ReactNode;
	readonly className?: string;
	readonly dataUi?: string;
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly resourceId?: string;
	readonly variant?: "default" | "primary";
}) => {
	const [uid] = useState(createId);
	const Component = variant === "primary" ? PrimaryButtonLink : ButtonLink;
	return (
		<Component
			to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
			params={{
				projectId,
				itemUid: uid,
				sectionId: "identity",
			}}
			search={{
				create: true,
				defaultDraft,
				defaultItemId,
				defaultTitle,
				resourceId,
			}}
			className={className}
			data-ui={dataUi}
		>
			{children}
		</Component>
	);
};
