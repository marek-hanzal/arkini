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
	it("reuses an equivalent corpus and invalidates changed identities, direct and related terms", async () => {
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

		const candidate: FuseSearchCandidate<string> = {
			identity: "item",
			terms: [
				"Copper",
			],
			relatedTerms: [
				"Ore",
			],
		};
		await render(
			[
				candidate,
			],
			"copper",
		);
		expect(container.textContent).toBe("item");
		expect(fuseState.constructionCount).toBe(1);

		await render(
			[
				{
					...candidate,
				},
			],
			"ore",
		);
		expect(container.textContent).toBe("item");
		expect(fuseState.constructionCount).toBe(1);

		const renamed = {
			...candidate,
			terms: [
				"Silver",
			],
		};
		await render(
			[
				renamed,
			],
			"silver",
		);
		expect(container.textContent).toBe("item");
		expect(fuseState.constructionCount).toBe(2);

		const related = {
			...renamed,
			relatedTerms: [
				"Metal",
			],
		};
		await render(
			[
				related,
			],
			"ore",
		);
		expect(container.textContent).toBe("");
		expect(fuseState.constructionCount).toBe(3);

		await render(
			[
				{
					...related,
					identity: "replacement",
				},
			],
			"metal",
		);
		expect(container.textContent).toBe("replacement");
		expect(fuseState.constructionCount).toBe(4);
	});
});
