// @vitest-environment jsdom

import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { useItemDetailLinesEquality } from "~/bridge/item-detail/useItemDetailLinesEquality";

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

const makeProjection = (
	reason: ItemDetailLines.DisabledReason,
): Extract<
	ItemDetailLines.Projection,
	{
		readonly kind: "available";
	}
> => ({
	kind: "available",
	itemId: "runtime:producer",
	line: [
		{
			lineId: "line:produce",
			title: "Produce",
			description: "Produce material.",
			baseRuntimeMs: 1_000,
			effectiveRuntimeMs: 1_000,
			availability: {
				kind: "unavailable",
				reason,
			},
			startMode: "start",
			isDefault: false,
			autonomous: {
				enabled: false,
				supported: false,
			},
			actions: {
				canAutofill: false,
				canStart: false,
				canWithdraw: false,
			},
			input: [],
			output: [],
		},
	],
});

const lineDisabledReason = {
	kind: "line-disabled",
	cause: {
		kind: "enable-rule",
		ruleIndex: 0,
		whenIndex: 0,
		condition: {
			kind: "exists",
			selector: {
				kind: "item",
				label: "Material",
			},
			locationLabel: "Board · close",
			detail: {
				itemId: "material",
				title: "Material",
				sourceUrl: "resource:material",
			},
		},
	},
	messageBeforeDetail: "Requires ",
	messageAfterDetail: " · Board · close.",
	message: "Requires Material (Board · close).",
} as const satisfies ItemDetailLines.DisabledReason;

const directMaxCountReason = {
	kind: "direct-output-max-count",
	itemId: "material",
	itemTitle: "Material",
	liveQuantity: 1,
	reservedQuantity: 0,
	maxCount: 1,
	messageAfterTitle: "limit reached (1/1).",
	message: "Material limit reached (1/1).",
} as const satisfies ItemDetailLines.DisabledReason;

const downstreamMaxCountReason = {
	kind: "downstream-output-max-count",
	intermediateItemId: "blueprint",
	intermediateItemTitle: "Blueprint",
	itemId: "material",
	itemTitle: "Material",
	liveQuantity: 1,
	reservedQuantity: 0,
	maxCount: 1,
	messageAfterTitle: "limit reached (1/1).",
	message: "Material limit reached (1/1).",
} as const satisfies ItemDetailLines.DisabledReason;

const EqualityProbe = ({ projection }: { readonly projection: ItemDetailLines.Projection }) => {
	const isEqual = useItemDetailLinesEquality();
	const selected = useRef(projection);
	const selectionChanges = useRef(1);
	if (!isEqual(selected.current, projection)) {
		selected.current = projection;
		selectionChanges.current += 1;
	}
	const reason =
		selected.current.kind === "available" &&
		selected.current.line[0]?.availability.kind === "unavailable"
			? selected.current.line[0].availability.reason
			: undefined;
	return createElement("output", {
		"data-reason": JSON.stringify(reason),
		"data-selection-changes": String(selectionChanges.current),
	});
};

const renderProjection = async (projection: ItemDetailLines.Projection) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(EqualityProbe, {
				projection,
			}),
		);
	});
	return {
		output: container.querySelector("output"),
		rerender: async (next: ItemDetailLines.Projection) => {
			await act(async () => {
				root.render(
					createElement(EqualityProbe, {
						projection: next,
					}),
				);
			});
		},
	};
};

describe("useItemDetailLinesEquality", () => {
	it("returns one stable comparator across consumers", () => {
		expect(useItemDetailLinesEquality()).toBe(useItemDetailLinesEquality());
	});

	it("retains the previous projection when every nested plain value is structurally equal", async () => {
		const { output, rerender } = await renderProjection(makeProjection(lineDisabledReason));

		await rerender(
			makeProjection({
				...lineDisabledReason,
				cause: {
					...lineDisabledReason.cause,
					condition: {
						...lineDisabledReason.cause.condition,
						selector: {
							...lineDisabledReason.cause.condition.selector,
						},
						detail: {
							...lineDisabledReason.cause.condition.detail,
						},
					},
				},
			}),
		);

		expect(output?.dataset.selectionChanges).toBe("1");
	});

	it.each([
		{
			name: "messageBeforeDetail",
			previous: lineDisabledReason,
			next: {
				...lineDisabledReason,
				messageBeforeDetail: "Needs ",
			},
			expected: '"messageBeforeDetail":"Needs "',
		},
		{
			name: "messageAfterDetail",
			previous: lineDisabledReason,
			next: {
				...lineDisabledReason,
				messageAfterDetail: " · Inventory.",
			},
			expected: '"messageAfterDetail":" · Inventory."',
		},
		{
			name: "max-count itemTitle",
			previous: directMaxCountReason,
			next: {
				...directMaxCountReason,
				itemTitle: "Refined Material",
			},
			expected: '"itemTitle":"Refined Material"',
		},
		{
			name: "downstream intermediateItemTitle",
			previous: downstreamMaxCountReason,
			next: {
				...downstreamMaxCountReason,
				intermediateItemTitle: "Advanced Blueprint",
			},
			expected: '"intermediateItemTitle":"Advanced Blueprint"',
		},
	])("publishes a render-distinct projection when $name changes", async ({
		expected,
		next,
		previous,
	}) => {
		const { output, rerender } = await renderProjection(makeProjection(previous));

		await rerender(makeProjection(next));

		expect(output?.dataset.selectionChanges).toBe("2");
		expect(output?.dataset.reason).toContain(expected);
	});
});
