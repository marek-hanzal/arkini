import type { PropsWithChildren } from "react";

import { EditorFormCard } from "~/ui/form/EditorFormCard";

export const EditorFormContent = ({
	children,
	className,
	error,
	rootCard = true,
	save,
}: PropsWithChildren<{
	readonly className?: string;
	readonly error: unknown;
	readonly rootCard?: boolean;
	readonly save: () => Promise<boolean>;
}>) => (
	<form
		className="min-h-0 flex-1"
		noValidate
		onSubmit={(event) => {
			event.preventDefault();
			event.stopPropagation();
			void save().catch(() => undefined);
		}}
	>
		{rootCard ? (
			<EditorFormCard className={className}>
				{error === undefined ? null : (
					<p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
						{error instanceof Error ? error.message : String(error)}
					</p>
				)}
				{children}
			</EditorFormCard>
		) : (
			<div className={className}>
				{error === undefined ? null : (
					<p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
						{error instanceof Error ? error.message : String(error)}
					</p>
				)}
				{children}
			</div>
		)}
	</form>
);
