// @vitest-environment jsdom

import { act, createElement, forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
	AnimatePresence: ({ children }: { readonly children: ReactNode }) => children,
	motion: {
		span: forwardRef<
			HTMLSpanElement,
			HTMLAttributes<HTMLSpanElement> & {
				initial?: unknown;
				animate?: unknown;
				exit?: unknown;
				transition?: unknown;
			}
		>(
			(
				{
					initial: _initial,
					animate: _animate,
					exit: _exit,
					transition: _transition,
					...props
				},
				ref,
			) =>
				createElement("span", {
					...props,
					ref,
				}),
		),
	},
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: ({ resourceIds }: { readonly resourceIds: string[] }) =>
		resourceIds.map((resourceId) =>
			createElement("img", {
				key: resourceId,
				src: resourceId,
			}),
		),
}));
import { NeighborhoodArtworkBoard } from "~/item-authoring/ui/NeighborhoodArtworkBoard";

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
	document.body.replaceChildren();
});

describe("NeighborhoodArtworkBoard resource settlement", () => {
	it("retains the visible composition while newer artwork loads and ignores an obsolete completion", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderFn = async (sourceId: string) =>
			act(async () =>
				root.render(
					<NeighborhoodArtworkBoard
						items={{}}
						scale={1}
						rule={{
							sourceId,
							neighbors: {
								nw: {
									type: "ignore",
								},
								n: {
									type: "ignore",
								},
								ne: {
									type: "ignore",
								},
								w: {
									type: "ignore",
								},
								e: {
									type: "ignore",
								},
								sw: {
									type: "ignore",
								},
								s: {
									type: "ignore",
								},
								se: {
									type: "ignore",
								},
							},
						}}
					/>,
				),
			);
		const loadFn = async (image: HTMLImageElement) => {
			Object.defineProperties(image, {
				complete: {
					value: true,
				},
				naturalWidth: {
					value: 256,
				},
			});
			await act(async () =>
				image.dispatchEvent(
					new Event("load", {
						bubbles: true,
					}),
				),
			);
		};
		await renderFn("base");
		await renderFn("obsolete");
		const obsolete = container.querySelector<HTMLImageElement>('img[src="obsolete"]');
		if (obsolete === null) throw new Error("Expected a pending image.");
		expect(container.querySelector('img[src="base"]')).not.toBeNull();
		await renderFn("latest");
		await loadFn(obsolete);
		expect(container.querySelector('img[src="base"]')).not.toBeNull();
		expect(container.querySelector('img[src="obsolete"]')).toBeNull();
		const latest = container.querySelector<HTMLImageElement>('img[src="latest"]');
		if (latest === null) throw new Error("Expected the newest pending image.");
		await loadFn(latest);
		expect(container.querySelector('img[src="base"]')).toBeNull();
		expect(container.querySelector('img[src="latest"]')).toBe(latest);
	});
});
