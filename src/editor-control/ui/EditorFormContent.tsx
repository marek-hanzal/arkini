import { EditorFormError } from "~/authoring-session/ui/EditorFormError";
import type { PropsWithChildren } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";

export const EditorFormContent = ({
	children,
	error,
	fill = false,
	rootCard = true,
	saveFn,
}: PropsWithChildren<{
	readonly error: unknown;
	readonly fill?: boolean;
	readonly rootCard?: boolean;
	readonly saveFn: () => Promise<boolean>;
}>) => (
	<form
		className="min-h-0 flex-1"
		noValidate
		onSubmit={(event) => {
			event.preventDefault();
			event.stopPropagation();
			void saveFn().catch(() => undefined);
		}}
	>
		{rootCard ? (
			<EditorFormCard>
				<EditorFormError error={error} />
				{children}
			</EditorFormCard>
		) : (
			<div
				className="grid gap-3 data-[ui-fill=true]:flex data-[ui-fill=true]:h-full data-[ui-fill=true]:min-h-0 data-[ui-fill=true]:flex-col"
				{...readDataUiFn({
					dataUi: "EditorFormFields",
					state: {
						fill,
					},
				})}
			>
				<EditorFormError error={error} />
				{children}
			</div>
		)}
	</form>
);
