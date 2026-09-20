import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	useDismiss,
	useFloating,
	useHover,
	useInteractions,
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
	const [open, setOpenFn] = useState(false);
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpenFn,
		placement,
		strategy: "fixed",
		// The portal belongs to the viewport, not the trigger's clipped animation containers.
		middleware: [
			offset(8),
			flip({
				boundary: [],
				padding: 8,
			}),
			shift({
				boundary: [],
				padding: 8,
			}),
		],
		whileElementsMounted: autoUpdate,
	});
	const hover = useHover(context, {
		move: false,
	});
	const dismiss = useDismiss(context);
	const { getFloatingProps: getFloatingPropsFn, getReferenceProps: getReferencePropsFn } =
		useInteractions([
			hover,
			dismiss,
		]);

	return (
		<>
			{cloneElement(
				children,
				getReferencePropsFn({
					ref: refs.setReference,
				}),
			)}
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className={twMerge(
							"z-10 max-w-[min(40.5rem,calc(100vw-1rem))] rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs leading-5 break-words whitespace-normal text-foreground shadow-xl",
							contentClassName,
						)}
						{...getFloatingPropsFn()}
					>
						{content}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
