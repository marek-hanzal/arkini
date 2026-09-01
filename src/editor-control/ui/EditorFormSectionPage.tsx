import { Save, Trash2 } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

import {
	EditorSectionNavigation,
	EditorSectionNavigationSeparator,
} from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorPageHelp, type EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { EditorFormContent } from "~/editor-control/ui/EditorFormContent";

const EditorFormActions = ({
	discardFn,
	dirty,
	saving,
	saveFn,
}: {
	readonly discardFn: () => Promise<void>;
	readonly dirty: boolean;
	readonly saving: boolean;
	readonly saveFn: () => Promise<boolean>;
}) => (
	<div className="flex items-center gap-3">
		<LinkButton
			className="inline-flex items-center gap-1.5"
			disabled={saving}
			cursorIntent={saving ? "progress" : undefined}
			onClick={() => void discardFn().catch(() => undefined)}
		>
			<Trash2 className="size-4" />
			Discard
		</LinkButton>
		<PrimaryButton
			type="button"
			className="min-h-0 gap-1.5 px-4 py-2"
			disabled={!dirty || saving}
			cursorIntent={saving ? "progress" : undefined}
			onClick={() => void saveFn().catch(() => undefined)}
		>
			<Save className="size-4" />
			Save
		</PrimaryButton>
	</div>
);

/** Keeps routed form chrome mounted while only the active form section changes. */
export const EditorFormSectionPage = ({
	children,
	discardFn,
	dirty,
	error,
	help,
	leading,
	notice,
	rootCard,
	saveFn,
	saving,
	tabs,
	title,
}: PropsWithChildren<{
	readonly discardFn: () => Promise<void>;
	readonly dirty: boolean;
	readonly error: unknown;
	readonly help?: EditorPageHelpContent;
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
					<div className="flex items-center gap-3">
						{help === undefined ? null : (
							<>
								<EditorPageHelp {...help} />
								<EditorSectionNavigationSeparator />
							</>
						)}
						<EditorFormActions
							discardFn={discardFn}
							dirty={dirty}
							saving={saving}
							saveFn={saveFn}
						/>
					</div>
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
