import type { PropsWithChildren, ReactNode } from "react";

import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

interface EditorFormSectionProps extends PropsWithChildren {
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
		<div
			className={
				action === undefined
					? "min-w-0"
					: "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
			}
		>
			<EditorFormSectionDivider
				description={description}
				title={title}
			/>
			{action === undefined ? null : <div className="shrink-0">{action}</div>}
		</div>
		{children}
	</section>
);
