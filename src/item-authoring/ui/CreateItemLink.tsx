import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { createId } from "@paralleldrive/cuid2";
import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";

interface CreateItemLinkProps {
	readonly projectId: string;
	readonly children: ReactNode;
	readonly className?: string;
	readonly dataUi?: string;
	readonly defaultTitle?: string;
	readonly resourceUid?: string;
	readonly shortcut?: string;
	readonly variant?: "default" | "primary" | "link";
}

/** Carries explicit creation intent and its seed values into the item form. */
export const CreateItemLink = forwardRef<HTMLAnchorElement, CreateItemLinkProps>(
	function CreateItemLink(
		{
			projectId,
			children,
			className,
			dataUi,
			defaultTitle,
			resourceUid,
			shortcut,
			variant = "default",
		},
		forwardedRef,
	) {
		const [uid] = useState(createId);
		const linkRef = useRef<HTMLAnchorElement>(null);
		useImperativeHandle(forwardedRef, () => linkRef.current!);
		useSectionShortcuts({
			options:
				shortcut === undefined
					? []
					: [
							{
								shortcut,
							},
						],
			onSelectFn: () => linkRef.current?.click(),
		});
		const Component = {
			default: ButtonLink,
			primary: PrimaryButtonLink,
			link: LinkButtonLink,
		}[variant];
		return (
			<Component
				ref={linkRef}
				to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
				params={{
					projectId,
					itemUid: uid,
					sectionId: "identity",
				}}
				search={{
					create: true,
					defaultTitle,
					resourceUid,
				}}
				className={className}
				data-ui={dataUi}
			>
				{children}
			</Component>
		);
	},
);
