import type { PropsWithChildren } from "react";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";

export const EditorFormContent = ({
	children,
	error,
	rootCard = true,
	save,
}: PropsWithChildren<{
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
			<EditorFormCard>
				{error === undefined ? null : (
					<p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
						{error instanceof Error ? error.message : String(error)}
					</p>
				)}
				{children}
			</EditorFormCard>
		) : (
			<div>
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
