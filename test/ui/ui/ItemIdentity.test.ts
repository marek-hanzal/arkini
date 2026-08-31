// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ItemIdentity } from "~/ui/ui/ItemIdentity";

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
	it("renders one source URL without manufacturing another layer", async () => {
		const images = await renderIdentity();

		expect(images).toHaveLength(1);
		expect(images[0]).toMatchObject({
			src: "resource:base",
		});
	});

	it("renders two source URLs in tuple order", async () => {
		const images = await renderIdentity("resource:overlay");

		expect(images).toHaveLength(2);
		expect(images[0]).toMatchObject({
			src: "resource:base",
		});
		expect(images[1]).toMatchObject({
			src: "resource:overlay",
		});
	});
});
