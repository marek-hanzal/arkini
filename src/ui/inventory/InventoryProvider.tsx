import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InventoryContext } from "~/ui/inventory/InventoryContext";
import type {
	CloseInventoryProps,
	InventoryControl,
	InventoryState,
	OpenInventoryProps,
} from "~/ui/inventory/InventoryControl";

const closedState = {
	phase: "closed",
} as const satisfies InventoryState;

const focusableSelector = [
	"button:not([disabled])",
	"a[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

const canRestoreFocus = (element: HTMLElement) =>
	element.isConnected &&
	element.matches(focusableSelector) &&
	element.getAttribute("aria-disabled") !== "true" &&
	element.closest("[hidden], [inert]") === null &&
	element.style.display !== "none" &&
	element.style.visibility !== "hidden" &&
	element.style.pointerEvents !== "none";

/** Owns the idempotent open/close lifecycle of one non-modal Inventory surface. */
export const InventoryProvider = ({ children }: PropsWithChildren) => {
	const [state, setState] = useState<InventoryState>(closedState);
	const stateRef = useRef<InventoryState>(state);
	const restoreOriginRef = useRef<HTMLElement | null>(null);

	const publishState = useCallback((next: InventoryState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	const open = useCallback(
		({ origin = null }: OpenInventoryProps = {}) => {
			if (stateRef.current.phase === "open") return false;
			restoreOriginRef.current = null;
			publishState({
				phase: "open",
				origin,
			});
			return true;
		},
		[
			publishState,
		],
	);

	const close = useCallback(
		({ restoreFocus = true }: CloseInventoryProps = {}) => {
			const current = stateRef.current;
			if (current.phase === "closed") return false;
			restoreOriginRef.current = restoreFocus ? current.origin : null;
			publishState(closedState);
			return true;
		},
		[
			publishState,
		],
	);

	useEffect(() => {
		if (state.phase !== "closed") return;
		const origin = restoreOriginRef.current;
		restoreOriginRef.current = null;
		if (origin !== null && canRestoreFocus(origin)) origin.focus();
	}, [
		state.phase,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
				event.defaultPrevented ||
				stateRef.current.phase === "closed"
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			close();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [
		close,
	]);

	useEffect(
		() => () => {
			stateRef.current = closedState;
			restoreOriginRef.current = null;
		},
		[],
	);

	const control = useMemo<InventoryControl>(
		() => ({
			state,
			isOpen: state.phase === "open",
			open,
			close,
		}),
		[
			close,
			open,
			state,
		],
	);

	return <InventoryContext.Provider value={control}>{children}</InventoryContext.Provider>;
};
