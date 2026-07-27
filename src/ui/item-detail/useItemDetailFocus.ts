import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";

import type { ItemDetailState } from "~/ui/item-detail/ItemDetailControl";
import { dialogFocusableSelector, keepDialogFocusInside } from "~/ui/focus/keepDialogFocusInside";

/** Owns Item Detail focus entry, containment, and exact actor restoration. */
export const useItemDetailFocus = ({
	phase,
	origin,
	restoreFocus,
	focusKey,
}: {
	readonly phase: Exclude<
		ItemDetailState,
		{
			readonly phase: "closed";
		}
	>["phase"];
	readonly origin: HTMLElement | null;
	readonly restoreFocus: boolean;
	readonly focusKey: string;
}) => {
	const dialogRef = useRef<HTMLDivElement>(null);
	const originRef = useRef(origin);
	const restoreFocusRef = useRef(restoreFocus);
	useLayoutEffect(() => {
		originRef.current = origin;
		restoreFocusRef.current = restoreFocus;
	}, [
		origin,
		restoreFocus,
	]);

	useEffect(() => {
		dialogRef.current?.focus();
		return () => {
			if (!restoreFocusRef.current) return;
			const latestOrigin = originRef.current;
			if (
				latestOrigin !== null &&
				latestOrigin.isConnected &&
				latestOrigin.matches(dialogFocusableSelector) &&
				!latestOrigin.hidden &&
				latestOrigin.closest("[inert]") === null &&
				latestOrigin.style.display !== "none" &&
				latestOrigin.style.visibility !== "hidden" &&
				latestOrigin.style.pointerEvents !== "none"
			) {
				latestOrigin.focus();
				return;
			}
			document.querySelector<HTMLElement>('[data-ui="GameShell"]')?.focus();
		};
	}, []);

	useEffect(() => {
		if (phase !== "open") return;
		const dialog = dialogRef.current;
		const selectedTab = dialog?.querySelector<HTMLElement>(
			'[data-ui="ItemDetailTabs"] button[aria-selected="true"]:not([disabled])',
		);
		(selectedTab ?? dialog?.querySelector<HTMLElement>(dialogFocusableSelector))?.focus();
	}, [
		focusKey,
		phase,
	]);

	const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		keepDialogFocusInside({
			dialogRef,
			event,
		});
	};

	return {
		dialogRef,
		keepFocusInside,
	};
};
