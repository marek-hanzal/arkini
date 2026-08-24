// @vitest-environment jsdom

import { act, createElement, type PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { currentRuntime, openItemDetail, renderItemDetail } from "./ItemDetailModal.test/fixture";

const LineIdentityLink = ({
	children,
	disabled,
	itemId,
	lineId,
}: PropsWithChildren<{
	readonly disabled: boolean;
	readonly itemId: string;
	readonly lineId: string;
}>) =>
	createElement(
		"a",
		{
			"data-disabled": disabled ? "true" : "false",
			"data-item-id": itemId,
			"data-line-id": lineId,
			"data-ui": "TestItemLineIdentityLink",
			href: `/items/${itemId}/lines/${lineId}`,
		},
		children,
	);

describe("ItemDetailModal / line extension", () => {
	it("lets a host link the canonical line summary using authored item and line identities", async () => {
		const { readControl } = await renderItemDetail(undefined, LineIdentityLink);
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
				tab: "lines",
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const link = document.querySelector<HTMLAnchorElement>(
			'[data-ui="TestItemLineIdentityLink"]',
		);
		expect(link?.dataset.itemId).toBe("workshop");
		expect(link?.dataset.lineId).toBe("line:workshop:water");
		expect(link?.textContent).toBe("Water");
		expect(link?.parentElement?.tagName).toBe("H3");

		motionTestRuntime.autoComplete = false;
		const close = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemDetailCloseButton"]',
		);
		if (close === null) throw new Error("Missing Item Detail close control.");
		await act(async () => close.click());

		expect(readControl().state.phase).toBe("exiting");
		expect(
			document.querySelector<HTMLAnchorElement>('[data-ui="TestItemLineIdentityLink"]')
				?.dataset.disabled,
		).toBe("true");
	});
});
