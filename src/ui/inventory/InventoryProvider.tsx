import { type PropsWithChildren, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createInventoryControllerFx } from "~/ui/inventory/createInventoryControllerFx";
import { InventoryContext } from "~/ui/inventory/InventoryContext";
import type { InventoryControl } from "~/ui/inventory/InventoryControl";

const focusableSelector = [
	"button:not([disabled])",
	"a[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

/** Owns the idempotent open/close lifecycle of one non-modal Inventory surface. */
export const InventoryProvider = ({ children }: PropsWithChildren) => {
	const canRestoreFocus = (element: HTMLElement) =>
		element.isConnected &&
		element.matches(focusableSelector) &&
		element.getAttribute("aria-disabled") !== "true" &&
		element.closest("[hidden], [inert]") === null &&
		element.style.display !== "none" &&
		element.style.visibility !== "hidden" &&
		element.style.pointerEvents !== "none";
	const [controller] = useState(() => RendererRuntime.runSync(createInventoryControllerFx()));
	const state = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);

	useEffect(() => {
		if (state.phase !== "closed") return;
		const origin = RendererRuntime.runSync(controller.takeRestoreOriginFx);
		if (origin !== null && canRestoreFocus(origin)) origin.focus();
	}, [
		controller,
		state.phase,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
				event.defaultPrevented ||
				controller.getSnapshot().phase === "closed"
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			RendererRuntime.runSync(controller.closeFx());
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [
		controller,
	]);

	useEffect(
		() => () => {
			RendererRuntime.runSync(controller.resetFx);
		},
		[
			controller,
		],
	);

	const control = useMemo<InventoryControl>(
		() => ({
			state,
			isOpen: state.phase === "open",
			openFx: controller.openFx,
			closeFx: controller.closeFx,
		}),
		[
			controller,
			state,
		],
	);

	return <InventoryContext.Provider value={control}>{children}</InventoryContext.Provider>;
};
