import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

import type { ItemDetailState } from "~/item-detail-frame/type/ItemDetailControl";
import { overlayFocusableSelector } from "~/ui/focus/overlayFocusableSelector";

export namespace useItemDetailFocus {
	export interface Props {
		readonly phase: Exclude<
			ItemDetailState,
			{
				readonly phase: "closed";
			}
		>["phase"];
		readonly origin: HTMLElement | null;
		readonly restoreFocus: boolean;
		readonly focusKey: string;
	}

	export interface Output {
		readonly overlayRef: RefObject<HTMLDivElement | null>;
	}
}

/** Owns the deliberate modal focus handoff and return lifecycle. */
export const useItemDetailFocus = ({
	phase,
	origin,
	restoreFocus,
	focusKey,
}: useItemDetailFocus.Props): useItemDetailFocus.Output => {
	const overlayRef = useRef<HTMLDivElement>(null);
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
		const overlay = overlayRef.current;
		const selectedTab = overlay?.querySelector<HTMLElement>(
			'[data-ui="ItemDetailTabs"] button[data-ui-selected="true"]:not([disabled])',
		);
		(selectedTab ?? overlay?.querySelector<HTMLElement>(overlayFocusableSelector))?.focus();
		return () => {
			if (!restoreFocusRef.current) return;
			const latestOrigin = originRef.current;
			if (
				latestOrigin !== null &&
				latestOrigin.isConnected &&
				latestOrigin.matches(overlayFocusableSelector) &&
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
		const overlay = overlayRef.current;
		const selectedTab = overlay?.querySelector<HTMLElement>(
			'[data-ui="ItemDetailTabs"] button[data-ui-selected="true"]:not([disabled])',
		);
		(selectedTab ?? overlay?.querySelector<HTMLElement>(overlayFocusableSelector))?.focus();
	}, [
		focusKey,
		phase,
	]);

	return {
		overlayRef,
	};
};
