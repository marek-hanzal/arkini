import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tx } from "~/translation/ui/Tx";
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
	saveEnabled,
	saving,
	saveFn,
}: {
	readonly discardFn: () => Promise<void>;
	readonly saveEnabled: boolean;
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
			<Tx label="Discard" />
		</LinkButton>
		<PrimaryButton
			type="button"
			className="min-h-0 gap-1.5 px-4 py-2"
			disabled={!saveEnabled || saving}
			cursorIntent={saving ? "progress" : undefined}
			onClick={() => void saveFn().catch(() => undefined)}
		>
			<Save className="size-4" />
			<Tx label="Save" />
		</PrimaryButton>
	</div>
);

/** Keeps routed form chrome mounted while only the active form section changes. */
export const EditorFormSectionPage = ({
	children,
	contentMode = "scroll",
	discardFn,
	error,
	help,
	leading,
	notice,
	rootCard,
	saveEnabled,
	saveFn,
	saving,
	tabs,
	title,
}: PropsWithChildren<{
	readonly contentMode?: "scroll" | "viewport";
	readonly discardFn: () => Promise<void>;
	readonly error: unknown;
	readonly help?: EditorPageHelpContent;
	readonly leading?: ReactNode;
	readonly notice?: ReactNode;
	readonly rootCard?: boolean;
	readonly saveEnabled: boolean;
	readonly saveFn: () => Promise<boolean>;
	readonly saving: boolean;
	readonly tabs: ReactNode;
	readonly title?: ReactNode;
}>) => (
	<EditorSectionPage
		contentMode={contentMode}
		header={
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
							saveEnabled={saveEnabled}
							saving={saving}
							saveFn={saveFn}
						/>
					</div>
				}
			/>
		}
	>
		<div
			className="mx-auto grid w-4/5 min-w-0 gap-3 data-[ui-content-mode=viewport]:flex data-[ui-content-mode=viewport]:h-full data-[ui-content-mode=viewport]:min-h-0 data-[ui-content-mode=viewport]:flex-col data-[ui-content-mode=viewport]:overflow-y-auto data-[ui-content-mode=viewport]:p-3"
			{...readDataUiFn({
				dataUi: "EditorFormViewport",
				state: {
					contentMode,
				},
			})}
		>
			{notice}
			<EditorFormContent
				error={error}
				fill={contentMode === "viewport"}
				rootCard={rootCard}
				saveFn={saveFn}
			>
				<fieldset
					className="contents"
					disabled={saving}
					inert={saving}
				>
					{children}
				</fieldset>
			</EditorFormContent>
		</div>
	</EditorSectionPage>
);
