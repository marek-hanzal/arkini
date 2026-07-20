// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/bridge/item-detail/useResolveItemDetailTarget", () => ({
	useResolveItemDetailTarget:
		() =>
		({ itemId, requestedTab }: { itemId: string; requestedTab: string }) =>
			itemId === "runtime:missing"
				? ({
						kind: "unavailable",
					} as const)
				: ({
						kind: "available",
						itemId,
						tab: requestedTab,
						tabs: [
							"info",
							"status",
						],
					} as const),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Probe = ({ onControl }: { readonly onControl: (control: ItemDetailControl) => void }) => {
	const control = useItemDetailControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

const renderProvider = async () => {
	let control: ItemDetailControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ItemDetailProvider,
				null,
				createElement(Probe, {
					onControl: (next) => {
						control = next;
					},
				}),
			),
		);
	});
	if (control === undefined) throw new Error("Missing Item Detail control.");
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
		root,
	};
};

describe("ItemDetailProvider", () => {
	it("keeps target and phase exhaustive across switch, replacement, and stale completion", async () => {
		const { readControl } = await renderProvider();
		const origin = document.createElement("button");
		document.body.append(origin);

		await act(async () => {
			expect(
				readControl().openItemDetail({
					itemId: "runtime:first",
					tab: "info",
					origin,
				}),
			).toBe(true);
		});
		const entering = readControl().state;
		expect(entering).toMatchObject({
			phase: "entering",
			target: {
				itemId: "runtime:first",
				tab: "info",
				origin,
			},
		});
		if (entering.phase !== "entering") throw new Error("Expected entering state.");

		await act(async () => readControl().completeEnter(entering.generation));
		expect(readControl().state.phase).toBe("open");

		await act(async () => {
			readControl().openItemDetail({
				itemId: "runtime:first",
				tab: "status",
			});
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: entering.generation,
			target: {
				itemId: "runtime:first",
				tab: "status",
				origin,
			},
		});

		let firstClose: Promise<void> | undefined;
		await act(async () => {
			firstClose = readControl().close();
			expect(readControl().close()).toBe(firstClose);
		});
		expect(readControl().state.phase).toBe("exiting");

		await act(async () => {
			readControl().openItemDetail({
				itemId: "runtime:second",
				tab: "info",
			});
			await firstClose;
		});
		const replacement = readControl().state;
		expect(replacement).toMatchObject({
			phase: "entering",
			target: {
				itemId: "runtime:second",
				tab: "info",
			},
		});
		if (replacement.phase !== "entering") throw new Error("Expected replacement enter.");

		await act(async () => readControl().completeExit(entering.generation));
		expect(readControl().state.phase).toBe("entering");
		await act(async () => readControl().completeEnter(replacement.generation));
		expect(readControl().state.phase).toBe("open");
	});

	it("rejects stale targets without changing the closed owner", async () => {
		const { readControl } = await renderProvider();
		expect(
			readControl().openItemDetail({
				itemId: "runtime:missing",
				tab: "info",
			}),
		).toBe(false);
		expect(readControl().state).toEqual({
			phase: "closed",
		});
	});
});
