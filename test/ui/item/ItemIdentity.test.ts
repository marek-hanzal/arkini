// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ItemIdentity } from "~/ui/item/ItemIdentity";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.innerHTML = "";
});

const renderIdentity = async (compositeUrl?: string) => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(ItemIdentity, {
				...(compositeUrl === undefined
					? {}
					: {
							compositeUrl,
						}),
				sourceUrl: "resource:base",
				title: "Layered item",
			}),
		);
	});
	return [
		...host.querySelectorAll("img"),
	];
};

describe("ItemIdentity", () => {
	it("keeps one source centered at full size", async () => {
		const images = await renderIdentity();

		expect(images).toHaveLength(1);
		expect(images[0]?.className).toContain("inset-0 size-full");
	});

	it("stages two sources from top-left to bottom-right in tuple order", async () => {
		const images = await renderIdentity("resource:overlay");

		expect(images).toHaveLength(2);
		expect(images[0]).toMatchObject({
			src: "resource:base",
		});
		expect(images[0]?.className).toContain("top-0 left-0 size-3/4");
		expect(images[1]).toMatchObject({
			src: "resource:overlay",
		});
		expect(images[1]?.className).toContain("right-0 bottom-0 z-10 size-3/4");
	});
});
