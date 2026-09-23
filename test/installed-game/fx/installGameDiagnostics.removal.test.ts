import { Effect, Exit } from "effect";
import { afterEach, expect, it, vi } from "vitest";

import {
	DiagnosticRecordSchema,
	type DiagnosticRecord,
} from "~electron/contract/diagnostics/DiagnosticRecord";
import { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { formatGameDiagnosticHistoryTextFn } from "~/game-incident/fn/formatGameDiagnosticSessionTextFn";
import { readGameDiagnosticHistoryEntryFn } from "~/game-incident/fn/readGameDiagnosticHistoryEntryFn";
import { installGameDiagnosticsFx } from "~/game-incident/fx/installGameDiagnosticsFx";
import type { GameTransition } from "~/game-session/type/GameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const originalWindow = globalThis.window;
afterEach(() =>
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: originalWindow,
	}),
);

it("logs every committed removal loss beyond the history cap with owner, source, and reason", () => {
	const writeFn = vi.fn<(record: DiagnosticRecord) => Promise<void>>((record) => {
		DiagnosticRecordSchema.parse(record);
		return Promise.resolve();
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			serakki: {
				diagnostics: {
					writeFn,
				},
			},
		},
	});
	const config = createJobTestConfig();
	const events: GameEventSchema.Type[] = [
		{
			type: "job:aborted",
			itemUid: "forge",
			jobId: "job:work",
			ownerItemId: "runtime:forge",
			lineUid: "line:work",
			reason: "owner-removed",
		},
		...Array.from(
			{
				length: 101,
			},
			(_, index): GameEventSchema.Type => ({
				type: "item:discarded",
				ownerItemId: "runtime:forge",
				itemUid: "forge",
				itemId: `runtime:material:${index}`,
				quantity: index + 1,
				source: "reservation",
				reason: "board:full",
			}),
		),
	];
	for (const event of events) GameEventSchema.parse(event);
	const transition = {
		sequence: 7,
		previousRuntime: null,
		events,
		runtime: {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [],
			jobs: [],
			jobQueue: [],
			defaultLineByOwnerItemId: {},
		},
	} as unknown as GameTransition;
	let listenerFn: ((value: GameTransition) => void) | undefined;
	const diagnostics = Effect.runSync(
		installGameDiagnosticsFx({
			config,
			projectId: "project:test",
			projectRevision: 1,
			restored: false,
			runRendererEffectFn: (effect) => Effect.runSync(effect),
			session: {
				readFn: () => Exit.die("No Tick in this diagnostics fixture"),
				getFatalErrorFn: () => null,
				getTransitionSnapshotFn: () => transition,
				subscribeFatalErrorFn: () => () => undefined,
				subscribeTransitionsFn: (nextFn) => {
					listenerFn = nextFn;
					return () => undefined;
				},
			},
		}),
	);
	expect(writeFn.mock.calls.filter(([record]) => record.category[1] === "removal")).toHaveLength(
		0,
	);
	listenerFn?.(transition);
	const audit = writeFn.mock.calls
		.map(([record]) => record)
		.filter((record) => record.category[1] === "removal");
	expect(audit).toHaveLength(102);
	expect(audit[0]).toMatchObject({
		event: "job:aborted",
		sessionId: diagnostics.sessionId,
		data: {
			sequence: 7,
			jobId: "job:work",
			ownerItemId: "runtime:forge",
			lineUid: "line:work",
			reason: "owner-removed",
		},
	});
	expect(audit.at(-1)).toMatchObject({
		event: "item:discarded",
		data: {
			sequence: 7,
			ownerItemId: "runtime:forge",
			itemUid: "forge",
			itemId: "runtime:material:100",
			quantity: 101,
			source: "reservation",
			reason: "board:full",
		},
	});
	const entry = readGameDiagnosticHistoryEntryFn({
		config,
		transition,
		elapsedSincePreviousMs: 100,
		observedAt: "2026-09-14T10:00:00.000Z",
	});
	expect(entry.truncated).toBe(true);
	const text = formatGameDiagnosticHistoryTextFn({
		entries: [
			entry,
		],
		retainedLimit: 32,
		totalEntries: 1,
	});
	for (const detail of [
		"job:aborted",
		"item:discarded",
		"ownerItemId",
		"itemUid",
		"quantity",
		"reservation",
		"board:full",
	])
		expect(text).toContain(detail);
	diagnostics.close("discarded");
});
