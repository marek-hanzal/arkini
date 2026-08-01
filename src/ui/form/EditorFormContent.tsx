import type { PropsWithChildren } from "react";

export const EditorFormContent = ({
	children,
	error,
	save,
}: PropsWithChildren<{
	readonly error: unknown;
	readonly save: () => Promise<boolean>;
}>) => (
	<>
		{error === undefined ? null : (
			<p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
				{error instanceof Error ? error.message : String(error)}
			</p>
		)}
		<form
			className="min-h-0 flex-1"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void save().catch(() => undefined);
			}}
		>
			{children}
		</form>
	</>
);
