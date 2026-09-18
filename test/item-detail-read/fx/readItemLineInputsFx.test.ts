import { Effect } from "effect";
import { expect, it } from "vitest";

import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { readItemLineInputsFx } from "~/item-detail-read/fx/readItemLineInputsFx";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

const base = lineRunRuntime({
	water: [
		2,
	],
});
const owner = base.items[0];
const water = base.items[1];
const line = owner.item.lines[0];
const readFn = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readItemLineInputsFx({
			ownerItemId: owner.id,
			line,
			runtime,
		}),
	);

it("separates obtainable material from the exact slot's stored fill and does not count other owners or lines", () => {
	const empty = {
		...base,
		items: [
			owner,
		],
	};
	expect(readFn(empty)).toMatchObject([
		{
			inputIndex: 0,
			filled: 0,
			available: false,
			availableQuantity: 0,
			committed: false,
		},
	]);
	const source = {
		...water,
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	expect(
		readFn({
			...empty,
			items: [
				owner,
				source,
			],
		})[0],
	).toMatchObject({
		filled: 0,
		available: true,
		availableQuantity: 2,
	});
	expect(readFn(base)[0]).toMatchObject({
		filled: 2,
		available: false,
		availableQuantity: 0,
	});
	const anotherOwner = {
		...water,
		location: {
			...water.location,
			scope: "input",
			ownerItemId: "other",
			lineId: line.id,
			inputIndex: 0,
		},
	} satisfies RuntimeItemSchema.Type;
	const anotherLine = {
		...anotherOwner,
		id: "other-line-water",
		location: {
			...anotherOwner.location,
			ownerItemId: owner.id,
			lineId: "other-line",
		},
	} satisfies RuntimeItemSchema.Type;
	expect(
		readFn({
			...empty,
			items: [
				owner,
				anotherOwner,
				anotherLine,
			],
		})[0],
	).toMatchObject({
		filled: 0,
		available: false,
		availableQuantity: 0,
	});
	const otherSpace = {
		...source,
		location: {
			scope: "board",
			space: 1,
			position: {
				x: 0,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	expect(
		readFn({
			...empty,
			items: [
				owner,
				otherSpace,
			],
		})[0]?.available,
	).toBe(false);
});

it("keeps travelling material available but unfilled until canonical input settlement", () => {
	const delivery = {
		...water,
		location: {
			scope: "delivery",
			phase: "outbound",
			generation: 0,
			remainingDurationMs: 100,
			origin: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			target: {
				kind: "line-input",
				ownerItemId: owner.id,
				lineId: line.id,
				input: [
					{
						inputIndex: 0,
						quantity: 2,
					},
				],
			},
		},
	} satisfies RuntimeItemSchema.Type;
	expect(
		readFn({
			...base,
			items: [
				owner,
				delivery,
			],
		})[0],
	).toMatchObject({
		filled: 0,
		available: true,
		availableQuantity: 2,
		committed: false,
	});
	expect(readFn(base)[0]).toMatchObject({
		filled: 2,
		committed: false,
	});
});

it.each([
	"consume",
	"reserve",
] as const)(
	"retains filled %s material after job start without borrowing from another job or slot",
	(mode) => {
		const material = line.input[0];
		if (material.type !== "materials") throw new Error("Expected material fixture");
		const activeLine = {
			...line,
			input: [
				{
					...material,
					mode,
				},
				line.input[1],
			],
		} as typeof line;
		const activeOwner = {
			...owner,
			item: {
				...owner.item,
				lines: [
					activeLine,
				],
			},
		};
		const job = {
			id: "active-job",
			ownerItemId: owner.id,
			lineId: line.id,
			durationMs: 1000,
			remainingMs: 500,
		};
		const committed = {
			...water,
			quantity: 3,
			location: {
				scope: mode === "consume" ? "job" : "reserved",
				jobId: job.id,
				inputIndex: 0,
			},
		} satisfies RuntimeItemSchema.Type;
		const otherJob = {
			...committed,
			id: "other-job-water",
			location: {
				...committed.location,
				jobId: "other-job",
			},
		};
		const otherSlot = {
			...committed,
			id: "other-slot-water",
			location: {
				...committed.location,
				inputIndex: 1,
			},
		};
		expect(
			readFn({
				...base,
				jobs: [
					job,
				],
				items: [
					activeOwner,
					committed,
					otherJob,
					otherSlot,
				],
			})[0],
		).toMatchObject({
			filled: 3,
			committed: true,
		});
		expect(
			readFn({
				...base,
				items: [
					owner,
					otherJob,
				],
			})[0],
		).toMatchObject({
			filled: 0,
			available: false,
			availableQuantity: 0,
		});
	},
);

it("projects authored slots without runtime ownership for definition details", () => {
	const rows = Effect.runSync(
		readItemLineInputsFx({
			line: lineRunTestConfig.items.workshop.lines[0],
			runtime: base,
		}),
	);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		filled: 0,
		available: false,
		availableQuantity: 0,
		committed: false,
	});
});

it("counts all obtainable stock beyond one job capacity without including other spaces or claimed material", () => {
	const source = {
		...water,
		id: "free-water",
		quantity: 12,
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const toolbar = {
		...source,
		id: "toolbar-water",
		quantity: 4,
		location: {
			scope: "toolbar",
			position: {
				x: 0,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const far = {
		...source,
		id: "far-water",
		quantity: 100,
		location: {
			scope: "board",
			space: 1,
			position: {
				x: 0,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const claimed = {
		...source,
		id: "claimed-water",
		quantity: 100,
		location: {
			scope: "reserved",
			jobId: "other-job",
			inputIndex: 0,
		},
	} satisfies RuntimeItemSchema.Type;
	expect(
		readFn({
			...base,
			items: [
				owner,
				water,
				source,
				toolbar,
				far,
				claimed,
			],
		})[0],
	).toMatchObject({
		filled: 2,
		availableQuantity: 16,
	});
});

it("isolates active material and gives shared buffers only to the first same-line request", () => {
	const job = {
		id: "active",
		ownerItemId: owner.id,
		lineId: line.id,
		durationMs: 1000,
		remainingMs: 500,
	};
	const committed = {
		...water,
		id: "committed",
		quantity: 3,
		location: {
			scope: "reserved",
			jobId: job.id,
			inputIndex: 0,
		},
	} satisfies RuntimeItemSchema.Type;
	const free = {
		...water,
		id: "free",
		quantity: 5,
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const runtime = {
		...base,
		jobs: [
			job,
		],
		items: [
			owner,
			water,
			committed,
			free,
		],
		jobQueue: [
			{
				id: "first",
				ownerItemId: owner.id,
				lineId: line.id,
			},
			{
				id: "other",
				ownerItemId: "other-owner",
				lineId: line.id,
			},
			{
				id: "second",
				ownerItemId: owner.id,
				lineId: line.id,
			},
		],
	};
	const readWorkFn = (kind: "active" | "queued", id: string, snapshot = runtime) =>
		Effect.runSync(
			readItemLineInputsFx({
				ownerItemId: owner.id,
				line,
				runtime: snapshot,
				work: {
					kind,
					id,
				},
			}),
		)[0];
	expect(readWorkFn("active", "active")).toMatchObject({
		filled: 3,
		committed: true,
		availableQuantity: 5,
	});
	expect(readWorkFn("queued", "first")).toMatchObject({
		filled: 2,
		committed: false,
	});
	expect(readWorkFn("queued", "second")).toMatchObject({
		filled: 0,
		committed: false,
		available: true,
		availableQuantity: 5,
	});
	expect(readWorkFn("active", "missing")).toMatchObject({
		filled: 0,
		committed: false,
	});
	expect(
		readWorkFn("queued", "second", {
			...runtime,
			jobQueue: runtime.jobQueue.slice(1),
		}),
	).toMatchObject({
		filled: 2,
		committed: false,
	});
});
