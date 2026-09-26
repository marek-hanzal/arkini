import { GameConfigFx } from "~/game-config/context/GameConfigFx";
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
	water: 2,
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
		}).pipe(Effect.provideService(GameConfigFx, lineRunTestConfig)),
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
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
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
		availableQuantity: 1,
		canAutofill: true,
	});
	expect(readFn(base)[0]).toMatchObject({
		filled: 2,
		available: false,
		canAutofill: false,
		availableQuantity: 0,
	});
	expect(
		readFn({
			...base,
			items: [
				owner,
				water,
				{
					...source,
					id: "free-water",
				},
			],
		})[0],
	).toMatchObject({
		filled: 1,
		canAutofill: true,
		canWithdraw: true,
	});
	const anotherOwner = {
		...water,
		location: {
			...water.location,
			scope: "input",
			ownerItemId: "other",
			lineUid: line.uid,
			inputIndex: 0,
		},
	} satisfies RuntimeItemSchema.Type;
	const anotherLine = {
		...anotherOwner,
		id: "other-line-water",
		location: {
			...anotherOwner.location,
			ownerItemId: owner.id,
			lineUid: "other-line",
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
			scope: "board" as const,
			space: 1,
			position: {
				x: 1,
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
				scope: "board" as const,
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			target: {
				kind: "line-input",
				ownerItemId: owner.id,
				lineUid: line.uid,
				inputIndex: 0,
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
		availableQuantity: 1,
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
			lineUid: line.uid,
			durationMs: 1000,
			remainingMs: 500,
		};
		const committed = {
			...water,
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
			filled: 1,
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
		}).pipe(Effect.provideService(GameConfigFx, lineRunTestConfig)),
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
		location: {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const secondSource = {
		...source,
		id: "secondSource-water",
		location: {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const far = {
		...source,
		id: "far-water",
		location: {
			scope: "board" as const,
			space: 1,
			position: {
				x: 1,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const claimed = {
		...source,
		id: "claimed-water",
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
				secondSource,
				...[
					3,
					4,
				].map((x) => ({
					...source,
					id: `extra:${x}`,
					location: {
						...source.location,
						position: {
							x,
							y: 0,
						},
					},
				})),
				far,
				claimed,
			],
		})[0],
	).toMatchObject({
		filled: 1,
		availableQuantity: 4,
	});
});

it("reads the soonest running lifetime only from physical roots in this slot", () => {
	const timed = (
		id: string,
		remainingMs: number,
		enabled = true,
		durationMs = 12000,
	): RuntimeItemSchema.Type => ({
		...water,
		id,
		item: {
			...water.item,
			clock: {
				durationMs,
				enable: enabled,
				rules: [],
			},
		},
		schedule: {
			remainingDurationMs: remainingMs,
		},
	});
	const roots = [
		timed("later", 8000),
		timed("sooner", 3200, true, 6000),
		timed("paused", 100, false),
	];
	const snapshot = {
		...base,
		items: [
			owner,
			...roots,
		],
	};
	expect(readFn(snapshot)[0]).toMatchObject({
		filled: 3,
		canWithdraw: true,
		clock: {
			kind: "expiry",
			remainingMs: 3200,
			durationMs: 6000,
		},
	});
	const aged = {
		...snapshot,
		items: [
			owner,
			roots[0],
			{
				...roots[1],
				schedule: {
					remainingDurationMs: 3100,
				},
			},
		],
	};
	expect(readFn(aged)[0].clock?.remainingMs).toBe(3100);
	const outside = {
		...roots[1],
		location: {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
	};
	expect(
		readFn({
			...base,
			items: [
				owner,
				outside,
			],
		})[0],
	).toMatchObject({
		filled: 0,
		canWithdraw: false,
		clock: undefined,
	});
	const job = {
		id: "timed-job",
		ownerItemId: owner.id,
		lineUid: line.uid,
		durationMs: 1000,
		remainingMs: 500,
		outcome: {
			outcome: [],
		},
	};
	const active = {
		...roots[1],
		location: {
			scope: "job" as const,
			jobId: job.id,
			inputIndex: 0,
		},
	};
	expect(
		readFn({
			...base,
			jobs: [
				job,
			],
			items: [
				owner,
				active,
			],
		})[0],
	).toMatchObject({
		committed: true,
		canWithdraw: false,
		clock: {
			kind: "expiry",
			remainingMs: 3200,
			durationMs: 6000,
		},
	});
});

it("shows interval-only Clock phase from stored material without borrowing an unfilled source's clock", () => {
	const item: RuntimeItemSchema.Type = {
		...water,
		item: {
			...water.item,
			clock: {
				intervalMs: 10000,
				enable: true,
				rules: [],
			},
		},
		schedule: {
			remainingIntervalMs: 4200,
		},
	};
	expect(
		readFn({
			...base,
			items: [
				owner,
				item,
			],
		})[0].clock,
	).toEqual({
		kind: "cycle",
		remainingMs: 4200,
		durationMs: 10000,
	});
	expect(
		readFn({
			...base,
			items: [
				owner,
				{
					...item,
					item: {
						...item.item,
						clock: {
							...item.item.clock!,
							enable: false,
						},
					},
				},
			],
		})[0].clock,
	).toBeUndefined();
});

it("reports the selected external target's remaining units, including during an active job", () => {
	const unitLine = {
		...line,
		input: [
			{
				type: "units",
				units: {
					from: "target",
					cost: 1,
				},
				query: {
					distance: "far",
					selector: {
						type: "item",
						itemUid: water.item.uid,
					},
				},
			},
		],
	} satisfies typeof line;
	const source = {
		...water,
		remainingUnits: 7,
		item: {
			...water.item,
			units: {
				amount: 20,
			},
		},
		location: {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
	} satisfies RuntimeItemSchema.Type;
	const runtime = {
		...base,
		items: [
			{
				...owner,
				item: {
					...owner.item,
					lines: [
						unitLine,
					],
				},
			},
			source,
			{
				...source,
				id: "other-source",
				remainingUnits: 50,
				location: {
					...source.location,
					position: {
						x: 2,
						y: 0,
					},
				},
			},
		],
	};
	for (const running of [
		false,
		true,
	]) {
		const inputs = Effect.runSync(
			readItemLineInputsFx({
				ownerItemId: owner.id,
				line: unitLine,
				runtime: {
					...runtime,
					jobs: running
						? [
								{
									id: "job",
									ownerItemId: owner.id,
									lineUid: line.uid,
									durationMs: 1000,
									remainingMs: 500,
								},
							]
						: [],
				},
			}).pipe(Effect.provideService(GameConfigFx, lineRunTestConfig)),
		);
		expect(inputs[0]).toMatchObject({
			availableQuantity: 7,
			committed: running,
		});
	}
});
