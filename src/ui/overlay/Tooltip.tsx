import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	useDismiss,
	useFloating,
	useFocus,
	useHover,
	useInteractions,
	useRole,
	type Placement,
} from "@floating-ui/react";
import { cloneElement, type ReactElement, type ReactNode, useState } from "react";
import { twMerge } from "tailwind-merge";

interface TooltipProps {
	readonly children: ReactElement;
	readonly content: ReactNode;
	readonly contentClassName?: string;
	readonly placement?: Placement;
}

/** Positions short contextual help without coupling callers to Floating UI. */
export const Tooltip = ({
	children,
	content,
	contentClassName,
	placement = "top",
}: TooltipProps) => {
	const [open, setOpen] = useState(false);
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpen,
		placement,
		middleware: [
			offset(8),
			flip({
				altBoundary: true,
				boundary: "clippingAncestors",
			}),
			shift({
				altBoundary: true,
				boundary: "clippingAncestors",
				padding: 8,
			}),
		],
		whileElementsMounted: autoUpdate,
	});
	const hover = useHover(context, {
		move: false,
	});
	const focus = useFocus(context);
	const dismiss = useDismiss(context);
	const role = useRole(context, {
		role: "tooltip",
	});
	const { getFloatingProps, getReferenceProps } = useInteractions([
		hover,
		focus,
		dismiss,
		role,
	]);

	return (
		<>
			{cloneElement(
				children,
				getReferenceProps({
					ref: refs.setReference,
				}),
			)}
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className={twMerge(
							"z-10 max-w-72 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs leading-5 text-foreground shadow-xl",
							contentClassName,
						)}
						{...getFloatingProps()}
					>
						{content}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
