import type { PropsWithChildren, ReactNode } from "react";

export interface EditorFormSectionProps extends PropsWithChildren {
	readonly action?: ReactNode;
	readonly description?: string;
	readonly title: string;
}

/** Provides the shared visual and semantic boundary for one editor form concern. */
export const EditorFormSection = ({
	action,
	children,
	description,
	title,
}: EditorFormSectionProps) => (
	<section className="grid gap-4 rounded-2xl border border-line bg-surface/75 p-4 shadow-lg">
		<header className="flex min-w-0 items-start justify-between gap-4">
			<div className="min-w-0">
				<h2 className="text-base font-semibold">{title}</h2>
				{description === undefined ? null : (
					<p className="mt-1 text-xs leading-5 text-muted">{description}</p>
				)}
			</div>
			{action}
		</header>
		{children}
	</section>
);
