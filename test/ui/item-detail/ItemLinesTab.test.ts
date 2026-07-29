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
	runPendingAction: vi.fn(),
}));
const commands = vi.hoisted(() => ({
	enqueue: vi.fn(),
	setDefault: vi.fn(),
	unsetDefault: vi.fn(),
	withdraw: vi.fn(),
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => control,
}));
vi.mock("~/bridge/item-detail/useEnqueueItemDetailLine", () => ({
	useEnqueueItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "enqueue",
		run: commands.enqueue,
	}),
}));
vi.mock("~/bridge/item-detail/useSetDefaultItemDetailLine", () => ({
	useSetDefaultItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "default",
		run: commands.setDefault,
	}),
}));
vi.mock("~/bridge/item-detail/useUnsetDefaultItemDetailLine", () => ({
	useUnsetDefaultItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "default",
		run: commands.unsetDefault,
	}),
}));
vi.mock("~/bridge/item-detail/useWithdrawItemDetailLine", () => ({
	useWithdrawItemDetailLine: ({ pendingKey }: { readonly pendingKey: string }) => ({
		error: control.readActionError(pendingKey),
		pending: control.readPendingAction(pendingKey) === "withdraw",
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
	deliveryQuantity: 0,
	autofillAvailableQuantity: 0,
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
	isDefault,
	queuedRequestCount: 0,
	actions: {
		enqueue: {
			enabled: true,
		},
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
	initialQuery?: string,
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
					initialQuery,
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
	it("leaves an enqueue-ready line without a redundant readiness badge", async () => {
		await renderLines({
			...projection,
			line: [
				projection.line[0],
			],
		});

		expect(document.querySelector('[data-ui="TileLineReadinessBadge"]')).toBeNull();
		expect(document.body.textContent).not.toContain("Ready");
	});

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

	it("shows the exact aggregate quantity currently delivered to a material input", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...input,
							deliveryQuantity: 1,
							required: {
								min: 2,
								max: 2,
							},
						},
					],
				},
			],
		});

		const delivery = document.querySelector<HTMLElement>(
			'[data-ui="TileLineInputDeliveryQuantity"]',
		);
		expect(delivery?.textContent).toBe("1 / 2 on the way");
		expect(delivery?.className).toContain("opacity-70");
		expect(document.querySelector('[data-ui="TileLineInputStoredQuantity"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineInputWithdrawButton"]')).toBeNull();
	});

	it("transitions semantic input surfaces and makes them transparent under active progress", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					lineId: "line:available",
					input: [
						{
							...input,
							autofillAvailableQuantity: 4,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:delivery",
					input: [
						{
							...input,
							autofillAvailableQuantity: 4,
							deliveryQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:partial",
					input: [
						{
							...input,
							required: {
								min: 2,
								max: 2,
							},
							storedQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:stored",
					input: [
						{
							...input,
							storedQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:active",
					activeJob: {
						status: JobStatusEnumSchema.enum.Running,
						durationMs: 1_000,
						remainingMs: 500,
					},
					input: [
						{
							...input,
							storedQuantity: 1,
						},
					],
				},
				{
					...projection.line[0],
					lineId: "line:deposit",
					input: [
						depositInput,
					],
				},
			],
		});

		const renderedInput = (lineId: string) =>
			document.querySelector<HTMLElement>(
				`[data-line-id="${lineId}"] [data-ui="TileLineInput"]`,
			);
		const available = renderedInput("line:available");
		const delivery = renderedInput("line:delivery");
		const partial = renderedInput("line:partial");
		const stored = renderedInput("line:stored");
		const active = renderedInput("line:active");
		const deposit = renderedInput("line:deposit");

		expect(document.querySelector('[data-ui="TileLineInputsList"]')?.className).toContain(
			"pt-2",
		);
		expect(available?.dataset.inputState).toBe("available");
		expect(available?.className).toContain("bg-[var(--ak-list-row-active-surface)]");
		expect(available?.className).toContain("rounded-xl");
		expect(delivery?.dataset.inputState).toBe("delivery");
		expect(delivery?.className).toContain("bg-[var(--ak-line-input-delivery-surface)]");
		expect(partial?.dataset.inputState).toBe("available");
		expect(partial?.className).toContain("bg-[var(--ak-list-row-active-surface)]");
		expect(stored?.dataset.inputState).toBe("stored");
		expect(stored?.className).toContain("bg-[var(--ak-list-row-active-progress-surface)]");
		expect(active?.dataset.inputState).toBe("stored");
		expect(active?.dataset.surfaceSuppressed).toBe("true");
		expect(active?.className).toContain("ak-line-input");
		expect(active?.className).toContain("bg-transparent");
		expect(active?.className).not.toContain("bg-[var(--ak-list-row-active-progress-surface)]");
		expect(deposit?.dataset.inputState).toBe("available");
		expect(deposit?.className).toContain("bg-[var(--ak-list-row-active-surface)]");
	});

	it("retains the exact input row while delivery surface fades to transparent running state", async () => {
		const deliveryLine = {
			...projection.line[0],
			lineId: "line:stable-input",
			input: [
				{
					...input,
					deliveryQuantity: 1,
				},
			],
		};
		const { container, rerender } = await renderLines({
			...projection,
			line: [
				deliveryLine,
			],
		});
		const before = container.querySelector<HTMLElement>('[data-ui="TileLineInput"]');
		expect(before?.className).toContain("bg-[var(--ak-line-input-delivery-surface)]");

		await rerender({
			...projection,
			line: [
				{
					...deliveryLine,
					activeJob: {
						status: JobStatusEnumSchema.enum.Running,
						durationMs: 1_000,
						remainingMs: 900,
					},
					input: [
						input,
					],
				},
			],
		});

		const running = container.querySelector<HTMLElement>('[data-ui="TileLineInput"]');
		expect(running).toBe(before);
		expect(running?.dataset.surfaceSuppressed).toBe("true");
		expect(running?.className).toContain("bg-transparent");
		expect(running?.className).toContain("rounded-xl px-3 py-2");
	});

	it("shows autofill material truth and opens the first producer with a material filter", async () => {
		const { rerender } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...input,
							autofillAvailableQuantity: 4,
						},
					],
				},
			],
		});

		const availability = document.querySelector<HTMLElement>(
			'[data-ui="TileLineInputAutofillAvailability"]',
		);
		expect(availability?.textContent).toBe("4 available");
		expect(document.querySelector('[data-ui="TileLineInputProducerLink"]')).toBeNull();

		await rerender({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...input,
							autofillAvailableQuantity: 0,
							producerItemId: "runtime:lumber-yard",
						},
					],
				},
			],
		});
		const producerLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputProducerLink"]',
		);
		expect(producerLink?.textContent).toBe("None");
		expect(producerLink?.className).toContain("underline");
		expect(producerLink?.className).toContain("cursor-pointer");

		await act(async () => producerLink?.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:lumber-yard",
			linesSearchQuery: "Tree",
			origin: producerLink,
			tab: "lines",
		});
	});

	it("searches all lines when navigation provides an initial query", async () => {
		const { container } = await renderLines(projection, "Log");

		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("Log");
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
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
				enqueue: {
					enabled: true,
				},
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
				enqueue: {
					enabled: false,
				},
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
		expect(
			container.querySelector(
				'[data-line-id="line:capped"] [data-ui="TileLineStatusBadge"]',
			)?.textContent,
		).toBe("Disabled");
		expect(
			container.querySelector(
				'[data-line-id="line:inputs"] [data-ui="TileLineStatusBadge"]',
			),
		).toBeNull();
	});

	it("keeps a running job in Available when its line becomes unavailable", async () => {
		const runningUnavailable = {
			...line({
				active: true,
				lineId: "line:running-disabled",
				title: "Running Disabled",
			}),
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
				enqueue: {
					enabled: false,
				},
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const { container } = await renderLines({
			...projection,
			line: [
				runningUnavailable,
			],
		});
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:running-disabled",
		]);
		expect(container.textContent).toContain("Running Disabled");
		expect(container.textContent).not.toContain("This line is currently disabled.");
		expect(container.querySelector('[data-ui="TileLineUnavailableReason"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineReadinessBadge"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineStatusBadge"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineInput"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="TileLineOutputItem"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="TileLineFlowChevron"]')).not.toBeNull();
		expect(
			container.querySelector<HTMLButtonElement>('[data-ui="TileLineInputDetailLink"]')
				?.disabled,
		).toBe(true);
		expect(
			container.querySelector<HTMLButtonElement>('[data-ui="TileLineOutputDetailLink"]')
				?.disabled,
		).toBe(true);
	});

	it("keeps Paused as the only active-job status badge", async () => {
		const paused = {
			...line({
				active: true,
				lineId: "line:paused",
				title: "Paused line",
			}),
			activeJob: {
				status: JobStatusEnumSchema.enum.Paused,
				durationMs: 1_000,
				remainingMs: 500,
			},
		} as const satisfies useItemDetailLines.Line;
		const { container, rerender } = await renderLines({
			...projection,
			line: [
				paused,
			],
		});

		expect(
			container.querySelector('[data-ui="TileLineStatusBadge"]')?.textContent,
		).toBe("Paused");

		await rerender({
			...projection,
			line: [
				{
					...paused,
					activeJob: {
						...paused.activeJob,
						status: JobStatusEnumSchema.enum.AwaitingOutput,
					},
				},
			],
		});
		expect(container.querySelector('[data-ui="TileLineStatusBadge"]')).toBeNull();
	});

	it("searches unavailable source lines initially and preserves the query across subsets", async () => {
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
				enqueue: {
					enabled: false,
				},
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
		const { container } = await renderLines(mixed, "well limit");

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

		await selectAvailabilityFilter(container, "available");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(container.querySelector('[data-ui="ItemLinesSearchEmpty"]')).not.toBeNull();

		await selectAvailabilityFilter(container, "all");
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
				enqueue: {
					enabled: false,
				},
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
		const mixedProjection = {
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
		const { container, rerender } = await renderLines(projection);
		const available = () =>
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="available"]',
			);
		const all = () =>
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="all"]',
			);

		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();

		await rerender(unavailableProjection);
		expect(available()?.checked).toBe(false);
		expect(available()?.disabled).toBe(true);
		expect(available()?.closest("label")?.className).toContain("cursor-not-allowed");
		expect(available()?.closest("label")?.dataset.disabled).toBe("true");
		expect(all()?.checked).toBe(true);
		expect(container.querySelector('[data-ui="ItemLinesAvailableEmpty"]')).toBeNull();
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);

		await rerender(projection);
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(2);

		await rerender(mixedProjection);
		expect(available()?.checked).toBe(false);
		expect(available()?.disabled).toBe(false);
		expect(available()?.closest("label")?.className).toContain("cursor-pointer");
		expect(all()?.checked).toBe(true);
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

		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(container.querySelector('[data-ui="ItemLinesVisibleEmpty"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ItemLinesAvailableEmpty"]')).toBeNull();
		expect(container.textContent).toContain("No product line is currently visible.");
		expect(container.textContent).not.toContain("Choose All");
	});

	it("preserves local search for the same owner and resets it for an exact owner change", async () => {
		const { container, rerender } = await renderLines(projection);
		await setSearchQuery(container, "first");

		await rerender({
			...projection,
			line: projection.line.map((candidate) => ({
				...candidate,
				description: `${candidate.description} Live update.`,
			})),
		});
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("first");

		await rerender({
			...projection,
			itemId: "runtime:other-producer",
		});
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
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
			"41 available",
		);
		expect(document.querySelector('[data-input-kind="deposit"]')?.textContent).not.toContain(
			"33 available",
		);
	});

	it("shows only deposit availability without repeating its requirement or target title", async () => {
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

		const deposit = document.querySelector('[data-input-kind="deposit"]');
		expect(deposit?.textContent).toContain("1 available");
		expect(deposit?.textContent).not.toContain("2 /");
		expect(deposit?.textContent?.match(/Tree/g)).toHaveLength(1);
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
						enqueue: {
							enabled: true,
						},
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
		expect(lineWithdraw?.closest("section")?.querySelector("h4")?.textContent).toBe("Inputs");
		expect(lineWithdraw?.className).toContain("underline");
		expect(lineWithdraw?.className).toContain("border-0");
		expect(storedQuantity?.previousElementSibling?.contains(inputWithdraw ?? null)).toBe(true);
		expect(inputWithdraw?.className).toContain("underline");
		expect(inputWithdraw?.className).toContain("border-0");
		expect(storedQuantity?.parentElement?.className).toContain("items-baseline");

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
		expect(document.querySelector('[data-ui="TileLineInputWithdrawButton"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineWithdrawButton"]')).toBeNull();
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
						enqueue: {
							enabled: false,
						},
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
						enqueue: {
							enabled: false,
						},
						canWithdraw: false,
					},
				},
			],
		});

		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toContain("Tree would exceed limit (0/1 currently).");
		expect(reason?.className).not.toContain("border-t");
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
						enqueue: {
							enabled: false,
						},
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
		expect(reason?.textContent).toBe("TreeRequired · None available (Board · close)");
		expect(reason?.textContent).not.toContain("1 / None available");
		expect(reason?.className).not.toContain("border-t");
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
							locationLabel: "Board · close",
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
					messageAfterDetail: " · Board · close.",
					message: "Requires Stonemason I (Board · close).",
				},
			},
			actions: {
				enqueue: {
					enabled: false,
				},
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
		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toBe("Stonemason IRequired · Board · close");
		expect(reason?.className).not.toContain("border-t");
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

	it("fills the active row background with its exact completed progress", async () => {
		const { rerender } = await renderLines();
		const idleRow = document.querySelector<HTMLElement>('[data-line-id="line:first"]');
		const activeRow = document.querySelector<HTMLElement>('[data-line-id="line:second"]');
		const progress = activeRow?.querySelector<HTMLElement>('[data-ui="TileLineProgressFill"]');

		expect(idleRow?.querySelector('[data-ui="TileLineProgress"]')).toBeNull();
		expect(progress?.style.width).toBe("50%");
		expect(progress?.className).toContain("bg-[var(--ak-list-row-active-progress-surface)]");

		await rerender({
			...projection,
			line: projection.line.map((candidate) =>
				candidate.lineId === "line:second" && candidate.activeJob !== undefined
					? {
							...candidate,
							activeJob: {
								...candidate.activeJob,
								remainingMs: 250,
							},
						}
					: candidate,
			),
		});
		expect(
			document.querySelector<HTMLElement>(
				'[data-line-id="line:second"] [data-ui="TileLineProgressFill"]',
			)?.style.width,
		).toBe("75%");
	});

	it("keeps engine-eligible line actions clickable while their presentation status is pending", async () => {
		control.readPendingAction.mockImplementation((key: string) => {
			if (key.includes('"default"')) return "default";
			if (key.includes('"enqueue"')) return "enqueue";
			if (key.includes('"withdraw"')) return "withdraw";
			return null;
		});
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						enqueue: {
							enabled: true,
						},
						canWithdraw: true,
					},
					input: [
						{
							...input,
							canWithdraw: true,
							storedQuantity: 1,
						},
					],
				},
			],
		});
		const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
		const pendingLabels = [
			"Saving…",
			"Withdrawing…",
		];

		for (const label of pendingLabels) {
			const button = buttons.find((candidate) => candidate.textContent === label);
			expect(button, `Missing ${label} button.`).toBeDefined();
			expect(button?.disabled).toBe(false);
		}
		const enqueue = buttons.find((candidate) => candidate.textContent === "Enqueue");
		expect(enqueue?.disabled).toBe(false);
		expect(enqueue?.getAttribute("aria-busy")).toBe("true");
		expect(enqueue?.className).toContain("cursor-progress");
		expect(
			control.readPendingAction.mock.calls.map(([key]) => JSON.parse(key as string).at(-1)),
		).toEqual(
			expect.arrayContaining([
				"default",
				"enqueue",
				"withdraw",
			]),
		);
	});

	it("keeps Enqueue geometry and copy stable while its command is pending", async () => {
		control.readPendingAction.mockImplementation((key: string) =>
			key.includes('"enqueue"') ? "enqueue" : null,
		);
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
				},
			],
		});
		const button = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);
		expect(button?.textContent).toBe("Enqueue");
		expect(button?.getAttribute("aria-busy")).toBe("true");
		expect(button?.className).toContain("cursor-progress");
	});

	it("marks queued idle work in warning orange and explains its automatic start", async () => {
		const { container, rerender } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					queuedRequestCount: 2,
				},
			],
		});
		const queuedLine = container.querySelector<HTMLElement>('[data-ui="TileLine"]');
		expect(queuedLine?.dataset.queued).toBe("true");
		expect(queuedLine?.className).toContain("border-l-warning");
		expect(queuedLine?.querySelector('[data-ui="TileLineQueuedBadge"]')).toBeNull();
		expect(
			queuedLine?.querySelector('[data-ui="TileLineQueuedMessage"]')?.textContent,
		).toContain("Queued for automatic start when the required inputs become available.");

		await rerender({
			...projection,
			line: [
				{
					...projection.line[1],
					queuedRequestCount: 2,
				},
			],
		});
		const activeLine = container.querySelector<HTMLElement>('[data-ui="TileLine"]');
		expect(activeLine?.dataset.active).toBe("true");
		expect(activeLine?.dataset.queued).toBe("false");
		expect(activeLine?.className).toContain("border-l-success");
		expect(activeLine?.querySelector('[data-ui="TileLineQueuedBadge"]')).toBeNull();
		expect(activeLine?.querySelector('[data-ui="TileLineQueuedMessage"]')).toBeNull();
	});

	it("exposes Enqueue as the only line execution command", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						enqueue: {
							enabled: true,
						},
						canWithdraw: false,
					},
				},
			],
		});
		const enqueue = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);
		const runtime = document.querySelector<HTMLElement>('[data-ui="TileLineRuntime"]');
		expect(enqueue?.textContent).toBe("Enqueue");
		expect(document.querySelector('[data-ui="TileLineStartButton"]')).toBeNull();
		expect(
			enqueue !== null &&
				runtime !== null &&
				(enqueue.compareDocumentPosition(runtime) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
		await act(async () => enqueue?.click());
		expect(commands.enqueue).toHaveBeenCalledWith({
			ownerItemId: projection.itemId,
			lineId: projection.line[0]?.lineId,
		});
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
