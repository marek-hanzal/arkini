import type { PropsWithChildren, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";

export const editorSectionLinkClassName =
	"inline-flex shrink-0 items-center px-4 py-2 text-sm font-medium text-muted no-underline hover:bg-accent/10 hover:text-accent hover:no-underline data-[ui-selected=true]:bg-accent/10 data-[ui-selected=true]:text-accent";

interface EditorSectionShortcutNavigationProps<Value extends string> {
	readonly dataUi: string;
	readonly onChangeFn: (value: Value) => void;
	readonly options: ReadonlyArray<{
		readonly icon?: LucideIcon;
		readonly label: string;
		readonly value: Value;
	}>;
	readonly value: Value;
}

/** Renders compact link-like choices inside a section bar without presenting another tab row. */
export const EditorSectionShortcutNavigation = <Value extends string>({
	dataUi,
	onChangeFn,
	options,
	value,
}: EditorSectionShortcutNavigationProps<Value>) => (
	<>
		{options.map((option) => {
			const Icon = option.icon;
			return (
				<LinkButton
					key={option.value}
					className={`${editorSectionLinkClassName} gap-1.5`}
					onClick={() => onChangeFn(option.value)}
					{...readDataUiFn({
						dataUi,
						state: {
							selected: value === option.value,
						},
					})}
				>
					{Icon === undefined ? null : <Icon className="size-4 shrink-0" />}
					{option.label}
				</LinkButton>
			);
		})}
	</>
);

/** Keeps section links separate from primary actions, with optional help always last. */
export const EditorSectionBar = ({
	children,
	actions,
	help,
}: PropsWithChildren<{
	readonly actions?: ReactNode;
	readonly help?: ReactNode;
}>) => (
	<div
		className="flex min-w-0 items-center gap-3 border-t border-line px-3 text-sm"
		data-ui="EditorSectionBar"
	>
		<nav className="min-w-0 overflow-x-auto overscroll-x-contain">
			<div className="flex min-w-max items-center gap-1">{children}</div>
		</nav>
		<div className="ml-auto flex shrink-0 items-center gap-3 [&_[data-ui=EditorPageHelpOpen]]:w-5">
			{actions}
			{help}
		</div>
	</div>
);
