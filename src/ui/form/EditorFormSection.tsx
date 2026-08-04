import type { PropsWithChildren, ReactNode } from "react";

import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";

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
	<section className="grid gap-4 border-b border-line pb-6 last:border-b-0 last:pb-0">
		<header className="flex min-w-0 items-start justify-between gap-4">
			<div className="min-w-0">
				<div className="flex min-w-0 items-center gap-1">
					<h2 className="text-base font-semibold">{title}</h2>
					{description === undefined ? null : <EditorInfoTooltip content={description} />}
				</div>
				{description === undefined ? null : (
					<p className="mt-1 text-xs leading-5 text-muted">{description}</p>
				)}
			</div>
			{action}
		</header>
		{children}
	</section>
);
