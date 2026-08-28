import type { PropsWithChildren, ReactNode } from "react";

import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { EditorFormSaveButton } from "~/ui/form/EditorFormSaveButton";

/** Keeps routed form chrome mounted while only the active form section changes. */
export const EditorFormSectionPage = ({
	children,
	dirty,
	error,
	leading,
	notice,
	rootCard,
	save,
	saving,
	tabs,
	title,
}: PropsWithChildren<{
	readonly dirty: boolean;
	readonly error: unknown;
	readonly leading?: ReactNode;
	readonly notice?: ReactNode;
	readonly rootCard?: boolean;
	readonly save: () => Promise<boolean>;
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
						save={save}
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
				save={save}
			>
				{children}
			</EditorFormContent>
		</div>
	</EditorSectionPage>
);
