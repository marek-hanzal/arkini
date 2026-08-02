import type { PropsWithChildren } from "react";

import { EditorFormCard } from "~/ui/form/EditorFormCard";

export const EditorFormContent = ({
	children,
	className,
	error,
	save,
}: PropsWithChildren<{
	readonly className?: string;
	readonly error: unknown;
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
		<EditorFormCard className={className}>
			{error === undefined ? null : (
				<p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
					{error instanceof Error ? error.message : String(error)}
				</p>
			)}
			{children}
		</EditorFormCard>
	</form>
);
