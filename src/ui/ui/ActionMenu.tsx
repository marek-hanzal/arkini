import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	size,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
} from "@floating-ui/react";
import { useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export interface ActionMenuOption {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly icon: ReactNode;
	readonly disabled?: boolean;
	readonly onSelectFn: () => void;
}

/** Anchors a dismissible action menu to the caller's button; actions own their domain behavior. */
export const ActionMenu = ({
	options,
	renderTriggerFn,
}: {
	readonly options: readonly ActionMenuOption[];
	readonly renderTriggerFn: (
		props: ButtonHTMLAttributes<HTMLButtonElement> & {
			readonly ref: Ref<HTMLButtonElement>;
		},
	) => ReactNode;
}) => {
	const [open, setOpenFn] = useState(false);
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpenFn,
		placement: "bottom-end",
		whileElementsMounted: autoUpdate,
		middleware: [
			offset(6),
			flip(),
			shift({
				padding: 8,
			}),
			size({
				padding: 8,
				apply: ({ availableHeight, elements }) => {
					elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
				},
			}),
		],
	});
	const { getFloatingProps: getFloatingPropsFn, getReferenceProps: getReferencePropsFn } =
		useInteractions([
			useClick(context),
			useDismiss(context),
		]);

	return (
		<>
			{renderTriggerFn({
				...getReferencePropsFn(),
				ref: refs.setReference,
			})}
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						className="z-50 grid w-80 max-w-[calc(100vw-1rem)] gap-1 overflow-y-auto rounded-xl border border-control-border bg-surface p-1.5 shadow-2xl"
						style={floatingStyles}
						data-ui="ActionMenu"
						{...getFloatingPropsFn()}
					>
						{options.map((option) => (
							<button
								key={option.id}
								type="button"
								disabled={option.disabled}
								className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left text-foreground enabled:hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
								onClick={() => {
									setOpenFn(false);
									option.onSelectFn();
								}}
								{...readDataUiFn({
									dataUi: "ActionMenuOption",
									state: {
										id: option.id,
									},
								})}
							>
								<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-accent">
									{option.icon}
								</span>
								<span className="grid min-w-0 gap-0.5">
									<span className="text-sm font-semibold">{option.label}</span>
									<span className="text-xs leading-5 text-muted">
										{option.description}
									</span>
								</span>
							</button>
						))}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
