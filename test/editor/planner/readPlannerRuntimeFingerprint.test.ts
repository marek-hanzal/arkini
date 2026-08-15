import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPlannerRuntimeFingerprintFx } from "~/editor/planner/readPlannerRuntimeFingerprintFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";

const makeItem = (id: string) =>
	ItemSchema.parse({
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		description: id,
		id,
		maxStackSize: 10,
		scope: "any",
		title: id,
		type: "simple",
		uid: id,
	});

const owner = makeItem("owner");
const material = makeItem("material");

const makeRuntime = ({
	idPrefix = "first",
	reverseCollections = false,
	reverseQueue = false,
	swapDefaultLines = false,
	swapInputOwner = false,
	swapReservedJob = false,
}: {
	readonly idPrefix?: string;
	readonly reverseCollections?: boolean;
	readonly reverseQueue?: boolean;
	readonly swapDefaultLines?: boolean;
	readonly swapInputOwner?: boolean;
	readonly swapReservedJob?: boolean;
} = {}) => {
	const ids = {
		input: `${idPrefix}:input`,
		jobA: `${idPrefix}:job:a`,
		jobB: `${idPrefix}:job:b`,
		ownerA: `${idPrefix}:owner:a`,
		ownerB: `${idPrefix}:owner:b`,
		queueA: `${idPrefix}:queue:a`,
		queueB: `${idPrefix}:queue:b`,
		reserved: `${idPrefix}:reserved`,
	};
	const items: RuntimeSchema.Type["items"] = [
		{
			id: ids.ownerA,
			item: owner,
			location: {
				position: {
					x: 0,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
			quantity: 1,
			revision: `${idPrefix}:revision:owner:a`,
		},
		{
			id: ids.ownerB,
			item: owner,
			location: {
				position: {
					x: 1,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
			quantity: 1,
			revision: `${idPrefix}:revision:owner:b`,
		},
		{
			id: ids.input,
			item: material,
			location: {
				inputIndex: 0,
				lineId: "line:input",
				ownerItemId: swapInputOwner ? ids.ownerB : ids.ownerA,
				scope: "input",
			},
			quantity: 2,
			revision: `${idPrefix}:revision:input`,
		},
		{
			id: ids.reserved,
			item: material,
			location: {
				jobId: swapReservedJob ? ids.jobB : ids.jobA,
				scope: "reserved",
			},
			quantity: 1,
			revision: `${idPrefix}:revision:reserved`,
		},
	];
	const jobs: RuntimeSchema.Type["jobs"] = [
		{
			durationMs: 100,
			id: ids.jobA,
			lineId: "line:a",
			ownerItemId: ids.ownerA,
			remainingMs: 25,
		},
		{
			durationMs: 200,
			id: ids.jobB,
			lineId: "line:b",
			ownerItemId: ids.ownerB,
			remainingMs: 50,
		},
	];
	const queue: NonNullable<RuntimeSchema.Type["jobQueue"]> = [
		{
			id: ids.queueA,
			lineId: "line:queued:a",
			ownerItemId: ids.ownerA,
		},
		{
			id: ids.queueB,
			lineId: "line:queued:b",
			ownerItemId: ids.ownerB,
		},
	];
	const defaultLineEntries: ReadonlyArray<
		readonly [
			string,
			string | null,
		]
	> = swapDefaultLines
		? [
				[
					ids.ownerA,
					null,
				],
				[
					ids.ownerB,
					"line:default:a",
				],
			]
		: [
				[
					ids.ownerA,
					"line:default:a",
				],
				[
					ids.ownerB,
					null,
				],
			];

	return {
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		defaultLineByOwnerItemId: Object.fromEntries(
			reverseCollections
				? [
						...defaultLineEntries,
					].reverse()
				: defaultLineEntries,
		),
		items: reverseCollections
			? [
					...items,
				].reverse()
			: items,
		jobQueue: reverseQueue
			? [
					...queue,
				].reverse()
			: queue,
		jobs: reverseCollections
			? [
					...jobs,
				].reverse()
			: jobs,
	} satisfies RuntimeSchema.Type;
};

const readFingerprint = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(readPlannerRuntimeFingerprintFx(runtime));

describe("readPlannerRuntimeFingerprintFx", () => {
	it("canonicalizes runtime identities, revisions and unordered collections", () => {
		expect(readFingerprint(makeRuntime())).toBe(
			readFingerprint(
				makeRuntime({
					idPrefix: "renamed",
					reverseCollections: true,
				}),
			),
		);
	});

	it("preserves input and reservation relationships", () => {
		const fingerprint = readFingerprint(makeRuntime());

		expect(
			readFingerprint(
				makeRuntime({
					swapInputOwner: true,
				}),
			),
		).not.toBe(fingerprint);
		expect(
			readFingerprint(
				makeRuntime({
					swapReservedJob: true,
				}),
			),
		).not.toBe(fingerprint);
	});

	it("preserves FIFO queue order and exact default-line ownership", () => {
		const fingerprint = readFingerprint(makeRuntime());

		expect(
			readFingerprint(
				makeRuntime({
					reverseQueue: true,
				}),
			),
		).not.toBe(fingerprint);
		expect(
			readFingerprint(
				makeRuntime({
					swapDefaultLines: true,
				}),
			),
		).not.toBe(fingerprint);
	});
});
