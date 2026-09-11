import { Check, ChevronDown } from "lucide-react";

import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	size as floatingSize,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
} from "@floating-ui/react";
import { useState } from "react";

import { Button } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export interface EditorSelectOption<Value extends string> {
	readonly disabled?: boolean;
	readonly label: string;
	readonly value: Value;
}

/** Replaces visually inconsistent native selects with the editor's Floating UI menu. */
export const EditorSelect = <Value extends string>({
	label,
	onChangeFn,
	options,
	size = "large",
	value,
}: {
	readonly label: string;
	readonly onChangeFn: (value: Value) => void;
	readonly options: ReadonlyArray<EditorSelectOption<Value>>;
	readonly size?: "control" | "large";
	readonly value: Value;
}) => {
	const [open, setOpenFn] = useState(false);
	const selected = options.find((option) => option.value === value);
	const { context, floatingStyles, refs } = useFloating({
		middleware: [
			offset(4),
			flip(),
			shift({
				padding: 8,
			}),
			floatingSize({
				padding: 8,
				apply: ({ elements, rects }) => {
					elements.floating.style.width = `${rects.reference.width}px`;
				},
			}),
		],
		onOpenChange: setOpenFn,
		open,
		placement: "bottom-end",
		whileElementsMounted: autoUpdate,
	});
	const { getFloatingProps: getFloatingPropsFn, getReferenceProps: getReferencePropsFn } =
		useInteractions([
			useClick(context),
			useDismiss(context),
		]);

	return (
		<>
			<Button
				ref={refs.setReference}
				className="h-[var(--ak-control-min-height)] min-h-[var(--ak-control-min-height)] min-w-56 justify-between gap-3 border-line-strong bg-surface px-4 text-sm shadow-none data-[ui-size=large]:h-12 data-[ui-size=large]:min-h-12"
				title={label}
				{...getReferencePropsFn()}
				{...readDataUiFn({
					dataUi: "EditorSelectTrigger",
					state: {
						size,
					},
				})}
			>
				<span>{selected?.label ?? value}</span>
				<ChevronDown className="size-4 shrink-0 text-muted" />
			</Button>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						className="z-50 grid gap-1 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
						data-ui="EditorSelectMenu"
						style={floatingStyles}
						{...getFloatingPropsFn()}
					>
						{options.map((option) => (
							<button
								className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold enabled:hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent data-[ui-selected=false]:text-foreground data-[ui-selected=true]:bg-accent/10 data-[ui-selected=true]:text-accent"
								disabled={option.disabled}
								key={option.value}
								onClick={() => {
									onChangeFn(option.value);
									setOpenFn(false);
								}}
								type="button"
								{...readDataUiFn({
									dataUi: "EditorSelectOption",
									state: {
										selected: option.value === value,
									},
								})}
							>
								{option.label}
								{option.value === value ? (
									<Check className="size-4 shrink-0" />
								) : null}
							</button>
						))}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
