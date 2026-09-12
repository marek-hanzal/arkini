// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorVirtualCollection } from "~/editor-control/ui/EditorVirtualCollection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let width = 600;
const resizeCallbacks = new Set<() => void>();
const items = Array.from(
	{
		length: 1000,
	},
	(_, index) => `item-${index}`,
);
const itemKeyFn = (item: string) => item;
const renderItemFn = (item: string) => (
	<a
		href={`/${item}`}
		data-item={item}
	>
		{item}
	</a>
);

const renderFn = async (values = items, minColumnWidthRem?: number) => {
	await act(async () =>
		root.render(
			<div
				data-ui="EditorSectionPage"
				data-ui-content-mode="scroll"
			>
				<div data-ui="EditorSectionPageContent">
					<EditorVirtualCollection
						items={values}
						itemKeyFn={itemKeyFn}
						renderItemFn={renderItemFn}
						estimatedRowHeight={100}
						gapRem={0.5}
						minColumnWidthRem={minColumnWidthRem}
					/>
				</div>
			</div>,
		),
	);
};

beforeEach(() => {
	width = 600;
	resizeCallbacks.clear();
	vi.stubGlobal(
		"ResizeObserver",
		class {
			private readonly callback: ResizeObserverCallback;
			private readonly elements = new Set<Element>();
			constructor(callback: ResizeObserverCallback) {
				this.callback = callback;
				resizeCallbacks.add(this.notify);
			}
			observe(element: Element) {
				this.elements.add(element);
			}
			unobserve(element: Element) {
				this.elements.delete(element);
			}
			disconnect() {
				resizeCallbacks.delete(this.notify);
			}
			notify = () =>
				this.callback(
					[
						...this.elements,
					].map((target) => ({
						target,
						borderBoxSize: [
							{
								inlineSize: width,
								blockSize:
									target.getAttribute("data-ui") === "EditorSectionPage"
										? 400
										: 100,
							},
						],
						contentRect: target.getBoundingClientRect(),
					})) as unknown as ResizeObserverEntry[],
					this as unknown as ResizeObserver,
				);
		},
	);
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
		this: HTMLElement,
	) {
		return this.getAttribute("data-ui") === "EditorSectionPage" ? 400 : 100;
	});
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => width);
	vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
		this: HTMLElement,
	) {
		const scroll = this.closest<HTMLElement>('[data-ui="EditorSectionPage"]');
		return {
			x: 0,
			y: 0,
			left: 0,
			top: this === scroll ? 0 : -(scroll?.scrollTop ?? 0),
			width,
			height: 100,
			right: width,
			bottom: 100,
			toJSON: () => ({}),
		};
	});
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("EditorVirtualCollection", () => {
	it("mounts bounded rows and admits newly visible links when the existing page scrolls", async () => {
		await renderFn();
		expect(container.querySelectorAll("[data-item]").length).toBeLessThan(20);
		expect(container.querySelector('[data-item="item-0"]')).not.toBeNull();
		expect(container.querySelector('[data-item="item-100"]')).toBeNull();
		const scroll = container.querySelector<HTMLElement>('[data-ui="EditorSectionPage"]')!;
		await act(async () => {
			scroll.scrollTop = 10_800;
			scroll.dispatchEvent(new Event("scroll"));
		});
		expect(container.querySelector('[data-item="item-0"]')).toBeNull();
		expect(container.querySelector('[data-item="item-100"]')?.getAttribute("href")).toBe(
			"/item-100",
		);
		expect(container.querySelectorAll("[data-item]").length).toBeLessThan(20);
	});

	it("repartitions gallery rows on resize and applies filtered identity immediately", async () => {
		await renderFn(items, 18);
		expect(
			container.querySelector('[data-index="0"]')?.querySelectorAll("[data-item]"),
		).toHaveLength(2);
		await act(async () => {
			width = 320;
			for (const notifyFn of resizeCallbacks) notifyFn();
		});
		expect(
			container.querySelector('[data-index="0"]')?.querySelectorAll("[data-item]"),
		).toHaveLength(1);
		await renderFn(
			[
				"filtered-result",
			],
			18,
		);
		expect(container.querySelectorAll("[data-item]")).toHaveLength(1);
		expect(container.querySelector('[data-item="filtered-result"]')?.getAttribute("href")).toBe(
			"/filtered-result",
		);
	});
});
