import type { PropsWithChildren, ReactNode } from "react";

import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { PrimaryButton } from "~/ui/ui/Button";
import { EditorFormContent } from "~/editor-control/ui/EditorFormContent";

const EditorFormSaveButton = ({
	dirty,
	saving,
	saveFn,
}: {
	readonly dirty: boolean;
	readonly saving: boolean;
	readonly saveFn: () => Promise<boolean>;
}) => (
	<PrimaryButton
		type="button"
		className="min-h-0 px-4 py-2"
		disabled={!dirty || saving}
		cursorIntent={saving ? "progress" : undefined}
		onClick={() => void saveFn().catch(() => undefined)}
	>
		Save
	</PrimaryButton>
);

/** Keeps routed form chrome mounted while only the active form section changes. */
export const EditorFormSectionPage = ({
	children,
	dirty,
	error,
	leading,
	notice,
	rootCard,
	saveFn,
	saving,
	tabs,
	title,
}: PropsWithChildren<{
	readonly dirty: boolean;
	readonly error: unknown;
	readonly leading?: ReactNode;
	readonly notice?: ReactNode;
	readonly rootCard?: boolean;
	readonly saveFn: () => Promise<boolean>;
	readonly saving: boolean;
	readonly tabs: ReactNode;
	readonly title?: ReactNode;
}>) => (
	<EditorSectionPage
		tabs={
			<EditorSectionNavigation
				leading={leading}
				title={title}
				tabs={tabs}
				action={
					<EditorFormSaveButton
						dirty={dirty}
						saving={saving}
						saveFn={saveFn}
					/>
				}
			/>
		}
	>
		<div className="grid gap-3">
			{notice}
			<EditorFormContent
				error={error}
				rootCard={rootCard}
				saveFn={saveFn}
			>
				{children}
			</EditorFormContent>
		</div>
	</EditorSectionPage>
);
