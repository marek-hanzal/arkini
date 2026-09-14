import type { PropsWithChildren, ReactNode } from "react";

import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

interface EditorFormSectionProps extends PropsWithChildren {
	readonly action?: ReactNode;
	readonly description?: string;
	readonly title: string;
	readonly variant?: "primary" | "secondary";
}

/** Owns the gap between a section heading and its content; the parent spaces sections. */
export const EditorFormSection = ({
	action,
	children,
	description,
	title,
	variant,
}: EditorFormSectionProps) => (
	<section
		className="grid min-w-0 gap-3"
		data-ui="EditorFormSection"
	>
		<EditorFormSectionDivider
			action={action}
			description={description}
			title={title}
			variant={variant}
		/>
		{children}
	</section>
);
