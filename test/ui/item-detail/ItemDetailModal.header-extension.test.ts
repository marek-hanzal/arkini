// @vitest-environment jsdom

import { act, createElement, type PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { currentRuntime, openItemDetail, renderItemDetail } from "./ItemDetailModal.test/fixture";

const HeaderIdentityLink = ({
	children,
	disabled,
	itemId,
}: PropsWithChildren<{
	readonly disabled: boolean;
	readonly itemId: string;
}>) =>
	createElement(
		"a",
		{
			"data-disabled": disabled ? "true" : "false",
			"data-item-id": itemId,
			"data-ui": "TestItemDetailIdentityLink",
			href: `/items/${itemId}`,
		},
		children,
	);

describe("ItemDetailModal / header extension", () => {
	it("lets a host wrap the canonical identity without replacing its presentation", async () => {
		const { readControl } = await renderItemDetail(HeaderIdentityLink);
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const link = document.querySelector<HTMLAnchorElement>(
			'[data-ui="TestItemDetailIdentityLink"]',
		);
		expect(link?.dataset.itemId).toBe("workshop");
		expect(link?.getAttribute("href")).toBe("/items/workshop");
		expect(link?.querySelector('[data-ui="ItemDetailHeaderArtwork"]')).not.toBeNull();
		expect(link?.textContent).toContain("Workshop");

		motionTestRuntime.autoComplete = false;
		const close = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemDetailCloseButton"]',
		);
		if (close === null) throw new Error("Missing Item Detail close control.");
		await act(async () => close.click());

		expect(readControl().state.phase).toBe("exiting");
		expect(
			document.querySelector<HTMLAnchorElement>('[data-ui="TestItemDetailIdentityLink"]')
				?.dataset.disabled,
		).toBe("true");
	});
});
