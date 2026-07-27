// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import type { ItemDetailPendingAction } from "~/ui/item-detail/ItemDetailControl";
import { ItemLinesTab } from "~/ui/item-detail/ItemLinesTab";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const control = vi.hoisted(() => ({
	openItemDetailFx: vi.fn(),
	openItemDefinitionDetailFx: vi.fn(),
	readActionError: vi.fn((_key: string) => null),
	readPendingAction: vi.fn((_key: string): ItemDetailPendingAction | null => null),
	runPendingActionFx: vi.fn(),
}));
const commands = vi.hoisted(() => ({
	autofill: vi.fn(),
	setDefault: vi.fn(),
	start: vi.fn(),
	unsetDefault: vi.fn(),
	withdraw: vi.fn(),
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));
vi.mock("~/ui/reactivity/readSettledAsyncResultError", () => ({
	readSettledAsyncResultError: () => undefined,
}));
vi.mock("~/bridge/item-detail/useAutofillItemDetailLine", () => ({
	useAutofillItemDetailLine: () => ({
		result: undefined,
		run: commands.autofill,
	}),
}));
vi.mock("~/bridge/item-detail/useSetDefaultItemDetailLine", () => ({
	useSetDefaultItemDetailLine: () => ({
		result: undefined,
		run: commands.setDefault,
	}),
}));
vi.mock("~/bridge/item-detail/useStartItemDetailLine", () => ({
	useStartPendingItemDetailLine: () => ({
		result: undefined,
		start: commands.start,
	}),
}));
vi.mock("~/bridge/item-detail/useUnsetDefaultItemDetailLine", () => ({
	useUnsetDefaultItemDetailLine: () => ({
		result: undefined,
		run: commands.unsetDefault,
	}),
}));
vi.mock("~/bridge/item-detail/useWithdrawItemDetailLine", () => ({
	useWithdrawItemDetailLine: () => ({
		result: undefined,
		run: commands.withdraw,
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const input = {
	kind: "materials",
	inputIndex: 0,
	selector: {
		kind: "item",
		label: "Tree",
	},
	mode: "consume",
	required: {
		min: 1,
		max: 1,
	},
	storedQuantity: 0,
	maxStoredQuantity: 1,
	missingQuantity: 1,
	availableCapacity: 1,
	ready: true,
	canWithdraw: false,
	detail: {
		itemId: "tree",
		title: "Tree",
		sourceUrl: "resource:tree",
		detailItemId: "runtime:tree",
	},
} as const satisfies useItemDetailLines.Input;

const output = {
	weight: 1,
	roll: [
		{
			kind: "guaranteed",
			item: [
				{
					itemId: "log",
					title: "Log",
					quantity: {
						min: 1,
						max: 1,
					},
					sourceUrl: "resource:log",
					definitionItemId: "log",
				},
			],
		},
	],
} as const satisfies useItemDetailLines.OutputSet;

const depositInput = {
	kind: "deposit",
	selector: {
		kind: "item",
		label: "Tree",
	},
	distance: "close",
	requiredCharges: 1,
	availableCharges: 33,
	availableChargesLabel: "33",
	targetTitles: [
		"Tree",
	],
	ready: true,
	charges: {
		cost: 1,
		from: "target",
	},
	detail: {
		itemId: "tree",
		title: "Tree",
		sourceUrl: "resource:tree",
		detailItemId: "runtime:tree",
	},
} as const satisfies useItemDetailLines.Input;

const line = ({
	active = false,
	isDefault = false,
	lineId,
	title,
}: {
	readonly active?: boolean;
	readonly isDefault?: boolean;
	readonly lineId: string;
	readonly title: string;
}): useItemDetailLines.Line => ({
	lineId,
	title,
	description: `${title} description.`,
	baseRuntimeMs: 1_000,
	effectiveRuntimeMs: 1_000,
	availability: {
		kind: "available",
		readiness: "ready",
	},
	startMode: "start",
	isDefault,
	actions: {
		canAutofill: false,
		canStart: true,
		canWithdraw: false,
	},
	input: [
		input,
	],
	output: [
		output,
	],
	...(active
		? {
				activeJob: {
					status: JobStatusEnumSchema.enum.Running,
					durationMs: 1_000,
					remainingMs: 500,
				},
			}
		: {}),
});

const projection = {
	kind: "available",
	itemId: "runtime:producer",
	line: [
		line({
			lineId: "line:first",
			title: "First",
		}),
		line({
			active: true,
			isDefault: true,
			lineId: "line:second",
			title: "Second",
		}),
	],
} as const satisfies useItemDetailLines.Projection;

beforeEach(() => {
	for (const value of Object.values(control)) value.mockReset();
	control.readActionError.mockReturnValue(null);
	control.readPendingAction.mockReturnValue(null);
	control.openItemDetailFx.mockReturnValue(Effect.succeed(true));
	control.openItemDefinitionDetailFx.mockReturnValue(Effect.succeed(true));
	for (const value of Object.values(commands)) {
		value.mockReset();
	}
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderLines = async (
	lines: Extract<
		useItemDetailLines.Projection,
		{
			kind: "available";
		}
	> = projection,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const rerender = async (
		nextLines: Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>,
	) => {
		await act(async () => {
			root.render(
				createElement(ItemLinesTab, {
					key: nextLines.itemId,
					disabled: false,
					lines: nextLines,
				}),
			);
		});
	};
	await rerender(lines);
	return {
		container,
		rerender,
	};
};

const setSearchQuery = async (container: HTMLElement, value: string) => {
	const search = container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]');
	if (search === null) throw new Error("Expected Lines search input.");
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(search, value);
		search.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const selectAvailabilityFilter = async (container: HTMLElement, value: "available" | "all") => {
	const option = container.querySelector<HTMLInputElement>(
		`input[name="item-lines-availability"][value="${value}"]`,
	);
	if (option === null) throw new Error(`Expected ${value} availability option.`);
	await act(async () => option.click());
};

describe("ItemLinesTab", () => {
	it("opens exact input runtime detail and configured output detail from subtle artwork links", async () => {
		await renderLines();
		const inputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputDetailLink"]',
		);
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"]',
		);
		if (inputLink === null || outputLink === null) throw new Error("Missing item links.");

		expect(inputLink.disabled).toBe(false);
		expect(outputLink.disabled).toBe(false);
		expect(inputLink.className).toContain("enabled:cursor-pointer");
		expect(outputLink.className).toContain("enabled:cursor-pointer");

		await act(async () => inputLink.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:tree",
		});

		await act(async () => outputLink.click());
		expect(control.openItemDefinitionDetailFx).toHaveBeenCalledWith({
			itemId: "log",
		});
	});

	it("starts with line content and renders one decorative horizontal flow chevron per line", async () => {
		await renderLines();

		expect(document.body.textContent).not.toContain(
			"Current visibility, inputs, outputs and effective runtime.",
		);
		expect(document.body.textContent).not.toContain("visible lines");
		const chevrons = Array.from(
			document.querySelectorAll<HTMLElement>('[data-ui="TileLineFlowChevron"]'),
		);
		expect(chevrons).toHaveLength(projection.line.length);
		for (const chevron of chevrons) {
			expect(chevron.getAttribute("aria-hidden")).toBe("true");
			expect(chevron.querySelector("span")?.className).toContain(
				"icon-[lucide--chevron-right]",
			);
		}
	});

	it("defaults to Available and keeps input-starved lines while hiding unavailable lines", async () => {
		const inputStarved = {
			...line({
				lineId: "line:inputs",
				title: "Needs Water",
			}),
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			actions: {
				canAutofill: true,
				canStart: false,
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const unavailable = {
			...line({
				lineId: "line:capped",
				title: "Capped Well",
			}),
			availability: {
				kind: "unavailable",
				reason: {
					kind: "direct-output-max-count",
					itemId: "well",
					itemTitle: "Well",
					liveQuantity: 1,
					reservedQuantity: 0,
					maxCount: 1,
					messageAfterTitle: "limit reached (1/1).",
					message: "Well limit reached (1/1).",
				},
			},
			actions: {
				canAutofill: false,
				canStart: false,
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const downstreamUnavailable = {
			...unavailable,
			lineId: "line:downstream-capped",
			title: "Capped Blueprint",
			availability: {
				kind: "unavailable",
				reason: {
					kind: "downstream-output-max-count",
					intermediateItemId: "well-blueprint",
					intermediateItemTitle: "Well Blueprint",
					itemId: "well",
					itemTitle: "Well",
					liveQuantity: 1,
					reservedQuantity: 0,
					maxCount: 1,
					messageAfterTitle: "limit reached (1/1).",
					message: "Well limit reached (1/1).",
				},
			},
		} as const satisfies useItemDetailLines.Line;
		const mixed = {
			...projection,
			line: [
				unavailable,
				inputStarved,
				downstreamUnavailable,
				projection.line[0],
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container } = await renderLines(mixed);
		const available = container.querySelector<HTMLInputElement>(
			'input[name="item-lines-availability"][value="available"]',
		);
		const all = container.querySelector<HTMLInputElement>(
			'input[name="item-lines-availability"][value="all"]',
		);

		expect(
			container
				.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')
				?.getAttribute("role"),
		).toBe("radiogroup");
		expect(available?.checked).toBe(true);
		expect(all?.checked).toBe(false);
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:inputs",
			"line:first",
		]);
		expect(container.textContent).toContain("Needs Water");
		expect(container.textContent).not.toContain("Capped Well");
		expect(container.textContent).not.toContain("Capped Blueprint");

		await selectAvailabilityFilter(container, "all");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:capped",
			"line:inputs",
			"line:downstream-capped",
			"line:first",
		]);
	});

	it("composes search inside the selected subset without clearing query or reordering", async () => {
		const unavailable = {
			...line({
				lineId: "line:capped",
				title: "Capped Well",
			}),
			description: "Limited production line.",
			availability: {
				kind: "unavailable",
				reason: {
					kind: "direct-output-max-count",
					itemId: "well",
					itemTitle: "Well",
					liveQuantity: 1,
					reservedQuantity: 0,
					maxCount: 1,
					messageAfterTitle: "limit reached (1/1).",
					message: "Well limit reached (1/1).",
				},
			},
			actions: {
				canAutofill: false,
				canStart: false,
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const mixed = {
			...projection,
			line: [
				unavailable,
				...projection.line,
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container } = await renderLines(mixed);

		await setSearchQuery(container, "well limit");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(container.querySelector('[data-ui="ItemLinesSearchEmpty"]')).not.toBeNull();

		await selectAvailabilityFilter(container, "all");
		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("well limit");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:capped",
		]);

		await setSearchQuery(container, "");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:capped",
			"line:first",
			"line:second",
		]);
	});

	it("automatically selects All when Available becomes empty without switching back in a loop", async () => {
		const unavailable = {
			...projection.line[0],
			availability: {
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
					cause: {
						kind: "static",
					},
					message: "This line is currently disabled.",
				},
			},
			actions: {
				canAutofill: false,
				canStart: false,
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const unavailableProjection = {
			...projection,
			line: [
				unavailable,
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container, rerender } = await renderLines(projection);
		const available = () =>
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="available"]',
			);
		const all = () =>
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="all"]',
			);

		expect(available()?.checked).toBe(true);
		expect(all()?.checked).toBe(false);

		await rerender(unavailableProjection);
		expect(available()?.checked).toBe(false);
		expect(all()?.checked).toBe(true);
		expect(container.querySelector('[data-ui="ItemLinesAvailableEmpty"]')).toBeNull();
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);

		await rerender(projection);
		expect(available()?.checked).toBe(false);
		expect(all()?.checked).toBe(true);
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(2);

		await selectAvailabilityFilter(container, "available");
		expect(available()?.checked).toBe(true);
		await rerender(unavailableProjection);
		expect(available()?.checked).toBe(false);
		expect(all()?.checked).toBe(true);
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);
		expect(container.textContent).toContain("This line is currently disabled.");
	});

	it("selects All once for an owner with no visible lines and keeps the canonical empty state", async () => {
		const { container } = await renderLines({
			...projection,
			line: [],
		});

		expect(
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="available"]',
			)?.checked,
		).toBe(false);
		expect(
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="all"]',
			)?.checked,
		).toBe(true);
		expect(container.querySelector('[data-ui="ItemLinesVisibleEmpty"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ItemLinesAvailableEmpty"]')).toBeNull();
		expect(container.textContent).toContain("No product line is currently visible.");
		expect(container.textContent).not.toContain("Choose All");
	});

	it("preserves local controls for the same owner and resets them for an exact owner change", async () => {
		const { container, rerender } = await renderLines(projection);
		await selectAvailabilityFilter(container, "all");
		await setSearchQuery(container, "first");

		await rerender({
			...projection,
			line: projection.line.map((candidate) => ({
				...candidate,
				description: `${candidate.description} Live update.`,
			})),
		});
		expect(
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="all"]',
			)?.checked,
		).toBe(true);
		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("first");

		await rerender({
			...projection,
			itemId: "runtime:other-producer",
		});
		expect(
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="available"]',
			)?.checked,
		).toBe(true);
		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("");
	});

	it("renders the summed live charge pool for a deposit input", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...depositInput,
							availableChargesLabel: "41",
						},
					],
				},
			],
		});

		expect(document.querySelector('[data-input-kind="deposit"]')?.textContent).toContain(
			"1 / 41 available",
		);
		expect(document.querySelector('[data-input-kind="deposit"]')?.textContent).not.toContain(
			"1 / 33 available",
		);
	});

	it("keeps grouped deposit requirement and availability on their truthful sides", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...depositInput,
							requiredCharges: 2,
							availableCharges: 1,
							availableChargesLabel: "1",
						},
					],
				},
			],
		});

		expect(document.querySelector('[data-input-kind="deposit"]')?.textContent).toContain(
			"2 / 1 available",
		);
	});

	it("renders a missing deposit target as a human state instead of a malformed fraction", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...depositInput,
							availableCharges: 0,
							availableChargesLabel: "None",
							targetTitles: [],
						},
					],
				},
			],
		});

		const input = document.querySelector('[data-input-kind="deposit"]');
		expect(input?.textContent).toContain("None available");
		expect(input?.textContent).not.toContain("1 / None available");
	});

	it("withdraws the complete exact material input from its local row action", async () => {
		const filledProjection = {
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						canAutofill: false,
						canStart: true,
						canWithdraw: true,
					},
					input: [
						{
							...input,
							availableCapacity: 0,
							missingQuantity: 0,
							storedQuantity: 5,
							canWithdraw: true,
						},
					],
				},
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { rerender } = await renderLines(filledProjection);
		const inputWithdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputWithdrawButton"]',
		);
		const lineWithdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineWithdrawButton"]',
		);
		const storedQuantity = document.querySelector<HTMLElement>(
			'[data-ui="TileLineInputStoredQuantity"]',
		);

		expect(inputWithdraw).not.toBeNull();
		expect(lineWithdraw).not.toBeNull();
		expect(storedQuantity?.previousElementSibling?.contains(inputWithdraw ?? null)).toBe(true);

		await act(async () => inputWithdraw?.click());

		expect(commands.withdraw).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
			inputIndex: 0,
		});
		await act(async () => lineWithdraw?.click());
		expect(commands.withdraw).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
		});

		await rerender({
			...filledProjection,
			line: [
				{
					...filledProjection.line[0],
					input: [
						{
							...filledProjection.line[0].input[0],
							storedQuantity: 0,
							canWithdraw: false,
						},
					],
				},
			],
		});
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineInputWithdrawButton"]')
				?.disabled,
		).toBe(true);
	});

	it("retains exact buffered-input withdrawal when a live line becomes unavailable", async () => {
		const { container } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:tree",
							itemTitle: "Tree",
							liveQuantity: 1,
							reservedQuantity: 1,
							maxCount: 1,
							messageAfterTitle: "limit reached (1/1).",
							message: "Tree limit reached (2/1).",
						},
					},
					actions: {
						canAutofill: false,
						canStart: false,
						canWithdraw: true,
					},
					input: [
						{
							...input,
							missingQuantity: 0,
							storedQuantity: 1,
							canWithdraw: true,
						},
					],
				},
			],
		});
		await selectAvailabilityFilter(container, "all");

		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent,
		).toContain("Tree limit reached");
		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"] strong')?.textContent,
		).toBe("Tree");
		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent,
		).toContain("1/1");
		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent,
		).not.toContain("2/1");
		expect(document.querySelector('[data-ui="TileLineFlowChevron"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineUnavailableWithdrawals"]')).not.toBeNull();
		const withdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputWithdrawButton"]',
		);
		expect(withdraw?.disabled).toBe(false);
		await act(async () => withdraw?.click());
		expect(commands.withdraw).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
			inputIndex: 0,
		});
	});

	it("distinguishes a candidate-only max-count block from a reached live limit", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:tree",
							itemTitle: "Tree",
							liveQuantity: 0,
							reservedQuantity: 1,
							maxCount: 1,
							messageAfterTitle: "would exceed limit (0/1 currently).",
							message: "Tree limit reached (1/1).",
						},
					},
					actions: {
						canAutofill: false,
						canStart: false,
						canWithdraw: false,
					},
				},
			],
		});

		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toContain("Tree would exceed limit (0/1 currently).");
		expect(reason?.querySelectorAll("strong")).toHaveLength(1);
		expect(reason?.querySelector("strong")?.textContent).toBe("Tree");
	});

	it("renders a missing deposit dependency with canonical availability and opens its detail", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					availability: {
						kind: "unavailable",
						reason: {
							kind: "deposit-target-missing",
							selector: {
								kind: "item",
								label: "Tree",
							},
							distance: "close",
							detail: {
								itemId: "tree",
								title: "Tree",
								sourceUrl: "resource:tree",
								detailItemId: "runtime:tree",
							},
							messageBeforeDetail: "Requires ",
							messageAfterDetail: " · None available (Board · close).",
							message: "Requires Tree · None available (Board · close).",
						},
					},
					actions: {
						canAutofill: false,
						canStart: false,
						canWithdraw: false,
					},
					input: [
						{
							...depositInput,
							availableCharges: 0,
							availableChargesLabel: "None",
							targetTitles: [],
							ready: false,
						},
					],
				},
			],
		});

		expect(document.querySelector('[data-input-kind="deposit"]')).toBeNull();
		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toBe("Requires Tree · None available (Board · close).");
		expect(reason?.textContent).not.toContain("1 / None available");
		const link = reason?.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineUnavailableDependencyLink"]',
		);
		expect(link?.querySelector("img")?.getAttribute("src")).toBe("resource:tree");
		await act(async () => link?.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:tree",
		});
	});

	it("opens projected dependency artwork without reconstructing its identity", async () => {
		const dependency = {
			...projection.line[0],
			availability: {
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
					cause: {
						kind: "enable-rule",
						ruleIndex: 0,
						whenIndex: 0,
						condition: {
							kind: "exists",
							selector: {
								kind: "item",
								label: "Stonemason I",
							},
							detail: {
								itemId: "stonemason",
								title: "Stonemason I",
								sourceUrl: "resource:stonemason",
								detailItemId: "runtime:stonemason",
							},
						},
					},
					messageBeforeDetail: "Requires ",
					messageAfterDetail: ".",
					message: "Requires Stonemason I.",
				},
			},
			actions: {
				canAutofill: false,
				canStart: false,
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		await renderLines({
			...projection,
			line: [
				dependency,
			],
		});
		const link = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineUnavailableDependencyLink"]',
		);

		expect(link?.textContent).toContain("Stonemason I");
		expect(link?.querySelector("img")?.getAttribute("src")).toBe("resource:stonemason");
		expect(document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent).toBe(
			"Requires Stonemason I.",
		);
		await act(async () => link?.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:stonemason",
		});
	});

	it("keeps authored order, toggles default state, and reserves active border geometry", async () => {
		await renderLines();
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-ui="TileLine"]'));
		expect(rows.map((row) => row.dataset.lineId)).toEqual([
			"line:first",
			"line:second",
		]);
		expect(rows[0]?.className).toContain("border-l-2");
		expect(rows[0]?.className).toContain("border-l-line/55");
		expect(rows[1]?.className).toContain("border-l-2");
		expect(rows[1]?.className).toContain("border-l-success");
		expect(rows[1]?.className).toContain("ak-list-row-active");

		const buttons = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]'),
		);
		expect(buttons.map((button) => button.textContent)).toEqual([
			"Set default",
			"Unset default",
		]);

		await act(async () => {
			buttons[0]?.click();
			await Promise.resolve();
		});
		expect(commands.setDefault).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
		});

		await act(async () => {
			buttons[1]?.click();
			await Promise.resolve();
		});
		expect(commands.unsetDefault).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
		});
	});

	it("keeps engine-eligible line actions clickable while their presentation status is pending", async () => {
		control.readPendingAction.mockImplementation((key: string) => {
			if (key.includes('"autofill"')) return "autofill";
			if (key.includes('"default"')) return "default";
			if (key.includes('"start"')) return "start";
			if (key.includes('"withdraw"')) return "withdraw";
			return null;
		});
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						canAutofill: true,
						canStart: true,
						canWithdraw: true,
					},
					input: [
						{
							...input,
							canWithdraw: true,
						},
					],
				},
			],
		});
		const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
		const pendingLabels = [
			"Saving…",
			"Filling…",
			"Withdrawing…",
			"Starting…",
		];

		for (const label of pendingLabels) {
			const button = buttons.find((candidate) => candidate.textContent === label);
			expect(button, `Missing ${label} button.`).toBeDefined();
			expect(button?.disabled).toBe(false);
		}
		expect(
			control.readPendingAction.mock.calls.map(([key]) => JSON.parse(key as string).at(-1)),
		).toEqual(
			expect.arrayContaining([
				"autofill",
				"default",
				"start",
				"withdraw",
			]),
		);
	});

	it("filters authoritative visible lines by semantic facts without indexing volatile numbers", async () => {
		const advancedInput = {
			...input,
			selector: {
				kind: "tag",
				label: "knowledge:advanced",
			},
			detail: undefined,
			ready: false,
		} as const satisfies useItemDetailLines.Input;
		const advancedOutput = {
			weight: 1,
			roll: [
				{
					kind: "chance",
					chance: 0.65,
					item: [
						{
							itemId: "item:plank",
							title: "Plank",
							quantity: {
								min: 1,
								max: 4,
							},
						},
					],
				},
			],
		} as const satisfies useItemDetailLines.OutputSet;
		const searchable = {
			...projection,
			line: [
				projection.line[0],
				{
					...projection.line[1],
					title: "Advanced Knowledge",
					description: "Studies arcane production methods.",
					availability: {
						kind: "available",
						readiness: "inputs",
					},
					startMode: "enqueue",
					input: [
						advancedInput,
					],
					output: [
						advancedOutput,
					],
				},
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container } = await renderLines(searchable);

		expect(container.querySelector('[data-ui="ItemLinesSearch"]')).not.toBeNull();
		expect(
			container
				.querySelector('[data-ui="ItemLinesTab"]')
				?.querySelector('[data-ui="Scrollable"]'),
		).not.toBeNull();

		for (const query of [
			"arcane",
			"knowledge advanced",
			"item:plank",
			"missing inputs",
			"enqueue",
		]) {
			await setSearchQuery(container, query);
			expect(
				Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
					(row) => row.dataset.lineId,
				),
			).toEqual([
				"line:second",
			]);
		}

		await setSearchQuery(container, "500");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(container.querySelector('[data-ui="ItemLinesSearchEmpty"]')?.textContent).toContain(
			"No visible lines match “500”.",
		);

		await setSearchQuery(container, "");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:first",
			"line:second",
		]);
	});

	it("resolves searched identities against the latest live line projection", async () => {
		const { container, rerender } = await renderLines(projection);
		await setSearchQuery(container, "running");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);
		expect(container.textContent).toContain("0.5 s");

		const updated = {
			...projection,
			line: projection.line.map((candidate) =>
				candidate.lineId === "line:second" && candidate.activeJob !== undefined
					? {
							...candidate,
							activeJob: {
								...candidate.activeJob,
								remainingMs: 200,
							},
						}
					: candidate,
			),
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		await rerender(updated);

		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);
		expect(container.textContent).toContain("0.2 s");
	});
});
