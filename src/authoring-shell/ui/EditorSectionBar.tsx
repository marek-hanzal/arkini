import { ShortcutLabel } from "~/ui/ui/ShortcutLabel";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";
import { Tooltip } from "~/ui/ui/Tooltip";
import type { PropsWithChildren, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";

interface EditorSectionShortcutNavigationProps<Value extends string> {
	readonly dataUi: string;
	readonly onChangeFn: (value: Value) => void;
	readonly options: ReadonlyArray<{
		readonly icon?: LucideIcon;
		readonly label: string;
		readonly shortcut: string;
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
}: EditorSectionShortcutNavigationProps<Value>) => {
	useSectionShortcuts({
		options,
		onSelectFn: (option) => onChangeFn(option.value),
	});
	return (
		<>
			{options.map((option) => {
				const Icon = option.icon;
				return (
					<Tooltip
						key={option.value}
						content={`${option.label} · ${formatForDisplay({
							key: option.shortcut,
						})}`}
						placement="bottom"
					>
						<LinkButton
							className={`${sectionLinkClassName} gap-1.5`}
							onClick={() => onChangeFn(option.value)}
							{...readDataUiFn({
								dataUi,
								state: {
									selected: value === option.value,
								},
							})}
						>
							{Icon === undefined ? null : <Icon className="size-4 shrink-0" />}
							<ShortcutLabel
								label={option.label}
								shortcut={option.shortcut}
							/>
						</LinkButton>
					</Tooltip>
				);
			})}
		</>
	);
};

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
