// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IFuseOptions } from "fuse.js";

import type { FuseSearchCandidate } from "~/ui/ui/useFuseSearch";
import { useFuseSearch } from "~/ui/ui/useFuseSearch";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const fuseState = vi.hoisted(() => ({
	constructionCount: 0,
}));

vi.mock("fuse.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("fuse.js")>();
	return {
		default: class ObservedFuse<T> extends actual.default<T> {
			constructor(documents: ReadonlyArray<T>, options?: IFuseOptions<T>) {
				super(documents, options);
				fuseState.constructionCount += 1;
			}
		},
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];

const Harness = ({
	candidates,
	query,
}: {
	readonly candidates: readonly FuseSearchCandidate<string>[];
	readonly query: string;
}) => {
	const identities = useFuseSearch(candidates, query);
	return createElement("output", null, identities.join(","));
};

beforeEach(() => {
	fuseState.constructionCount = 0;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("useFuseSearch", () => {
	it("preserves empty order and rebuilds Fuse only when identities or semantic terms change", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const render = async (
			candidates: readonly FuseSearchCandidate<string>[],
			query: string,
		) => {
			await act(async () => {
				root.render(
					createElement(Harness, {
						candidates,
						query,
					}),
				);
			});
		};

		await render(
			[
				{
					identity: "first",
					terms: [
						"Alpha",
					],
				},
				{
					identity: "second",
					terms: [
						"Beta",
					],
				},
			],
			"",
		);
		expect(container.textContent).toBe("first,second");
		expect(fuseState.constructionCount).toBe(1);

		await render(
			[
				{
					identity: "first",
					terms: [
						"Alpha",
					],
				},
				{
					identity: "second",
					terms: [
						"Beta",
					],
				},
			],
			"beta",
		);
		expect(container.textContent).toBe("second");
		expect(fuseState.constructionCount).toBe(1);

		await render(
			[
				{
					identity: "first",
					terms: [
						"Alpha",
					],
				},
				{
					identity: "second",
					terms: [
						"Gamma",
					],
				},
			],
			"gamma",
		);
		expect(container.textContent).toBe("second");
		expect(fuseState.constructionCount).toBe(2);
	});

	it("returns only authored exact-term matches before fuzzy results", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(Harness, {
					candidates: [
						{
							identity: "exact:first",
							terms: [
								"Bakery I Blueprint",
							],
						},
						{
							identity: "fuzzy",
							terms: [
								"Blueprint: Bakery I",
							],
						},
						{
							identity: "exact:second",
							terms: [
								" bakery i blueprint ",
							],
						},
					],
					query: "BAKERY I BLUEPRINT",
				}),
			);
		});

		expect(container.textContent).toBe("exact:first,exact:second");
	});

	it("requires every fuzzy query token while ignoring its word order", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		const candidates = [
			{
				identity: "bio-waste-processor",
				terms: [
					"item:bio-waste-processor",
					"Bio-Waste Processor",
				],
			},
			{
				identity: "waste",
				terms: [
					"Waste",
				],
			},
			{
				identity: "processor",
				terms: [
					"Processor",
				],
			},
		];

		await act(async () => {
			root.render(
				createElement(Harness, {
					candidates,
					query: "was pro",
				}),
			);
		});
		expect(container.textContent).toBe("bio-waste-processor");

		await act(async () => {
			root.render(
				createElement(Harness, {
					candidates,
					query: "pro was",
				}),
			);
		});
		expect(container.textContent).toBe("bio-waste-processor");
	});
});
