import type { PropsWithChildren, ReactNode } from "react";

import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";

export interface EditorFormSectionProps extends PropsWithChildren {
	readonly action?: ReactNode;
	readonly description?: string;
	readonly title: string;
}

/** Provides a flat semantic boundary for one routed editor form concern. */
export const EditorFormSection = ({
	action,
	children,
	description,
	title,
}: EditorFormSectionProps) => (
	<section className="grid gap-4">
		<div className="flex min-w-0 items-center gap-4">
			<EditorFormSectionDivider
				className="min-w-0 flex-1"
				description={description}
				title={title}
			/>
			{action === undefined ? null : <div className="shrink-0">{action}</div>}
		</div>
		{children}
	</section>
);
