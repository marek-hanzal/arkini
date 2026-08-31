import {
	autoUpdate,
	flip,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
} from "@floating-ui/react";
import { useState } from "react";

/** Owns the shared bottom-aligned Floating UI behavior for compact editor menus. */
export const useEditorFloatingMenu = () => {
	const [open, setOpenFn] = useState(false);
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpenFn,
		placement: "bottom-end",
		middleware: [
			offset(6),
			flip(),
			shift({
				padding: 8,
			}),
		],
		whileElementsMounted: autoUpdate,
	});
	return {
		floatingStyles,
		open,
		refs,
		setOpenFn,
		...useInteractions([
			useClick(context),
			useDismiss(context),
		]),
	};
};
