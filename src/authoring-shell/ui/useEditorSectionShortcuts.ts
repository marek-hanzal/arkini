import { useHotkeys } from "@tanstack/react-hotkeys";

/** Registers only the mounted page's choices; navigation and draft policy stay with the caller. */
export const useEditorSectionShortcuts = <
	Option extends {
		readonly shortcut?: string;
		readonly shift?: boolean;
	},
>({
	enabled = true,
	onSelectFn,
	options,
}: {
	readonly enabled?: boolean;
	readonly onSelectFn: (option: Option) => void;
	readonly options: ReadonlyArray<Option>;
}) => {
	useHotkeys(
		options.flatMap((option) =>
			option.shortcut === undefined
				? []
				: [
						{
							hotkey: {
								key: option.shortcut,
								shift: option.shift ?? false,
							},
							callback: (event: KeyboardEvent) => {
								if (event.defaultPrevented || event.repeat || event.isComposing)
									return;
								event.preventDefault();
								event.stopPropagation();
								onSelectFn(option);
							},
						},
					],
		),
		{
			enabled,
			ignoreInputs: true,
			preventDefault: false,
			stopPropagation: false,
		},
	);
};
