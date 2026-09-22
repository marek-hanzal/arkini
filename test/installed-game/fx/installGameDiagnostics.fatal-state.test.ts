import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import {
	type DiagnosticRecord,
	DiagnosticRecordSchema,
} from "~electron/contract/diagnostics/DiagnosticRecord";
import {
	type GameIncidentWrite,
	GameIncidentWriteSchema,
} from "~electron/contract/incident/GameIncidentWrite";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { decodeSerakkiSaveFx } from "~/game-persistence/fx/decodeSerakkiSaveFx";
import { GameSessionFatalError } from "~/game-session/error/GameSessionFatalError";
import type { GameTransition } from "~/game-session/type/GameSession";
import { installGameDiagnosticsFx } from "~/game-incident/fx/installGameDiagnosticsFx";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const originalWindow = globalThis.window;
const ownerItemId = "runtime:item:depleted-owner";
const requestIds = [
	"job:queued:1",
	"job:queued:2",
];

afterEach(() => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: originalWindow,
	});
});

describe("Game fatal-state diagnostics", () => {
	it("records the committed state that explains queued work blocking depletion", () => {
		const write = vi.fn<(record: DiagnosticRecord) => Promise<void>>((record) => {
			DiagnosticRecordSchema.parse(record);
			return Promise.resolve();
		});
		const writeIncident = vi.fn<(incident: GameIncidentWrite) => Promise<void>>((incident) => {
			GameIncidentWriteSchema.parse(incident);
			return Promise.resolve();
		});
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				serakki: {
					diagnostics: {
						writeFn: write,
						writeApplicationFn: () => Promise.resolve(),
						openDirectoryFn: () => Promise.resolve(),
					},
					incident: {
						writeFn: writeIncident,
					},
				} as Pick<SerakkiElectronApi.Api, "diagnostics" | "incident">,
			},
		});
		let fatalListener: (() => void) | undefined;
		const baseConfig = createJobTestConfig();
		const ownerDefinition = {
			...baseConfig.items.forge,
			id: "producer:finite",
			uid: "uid:producer:finite",
			title: "Finite producer",
		};
		const config = {
			...baseConfig,
			items: {
				...baseConfig.items,
				[ownerDefinition.id]: ownerDefinition,
			},
		};
		const transition = {
			sequence: 357,
			previousRuntime: null,
			events: [
				{
					type: "job:started",
					canonicalItemId: ownerDefinition.id,
					jobId: "job:last",
					ownerItemId,
					lineId: "line:finite:work",
				},
			],
			runtime: {
				cheats: {
					enabled: false,
					everEnabled: false,
					speedUpGameplay: false,
				},
				currentSpace: 0,
				items: [
					{
						id: ownerItemId,
						item: ownerDefinition,
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 4,
								y: 2,
							},
						},

						revision: "revision:depleted-owner",
						remainingUnits: 0,
					},
				],
				jobs: [
					{
						id: "job:last",
						ownerItemId,
						lineId: "line:finite:work",
						durationMs: 5_000,
						remainingMs: 100,
					},
				],
				jobQueue: requestIds.map((id) => ({
					id,
					ownerItemId,
					lineId: "line:finite:work",
				})),
				defaultLineByOwnerItemId: {
					[ownerItemId]: "line:finite:work",
				},
			},
		} as unknown as GameTransition;
		const fatal = new GameSessionFatalError({
			source: "tick",
			cause: Cause.fail(
				new JobOwnerBusyError({
					ownerItemId,
					jobIds: [],
					requestIds,
				}),
			),
		});
		const diagnostics = Effect.runSync(
			installGameDiagnosticsFx({
				serapack: {
					packageId: "package:test",
					contentHash: "0".repeat(64),
					title: "Test",
					version: "1.0",
					serakki: "1",
					source: "bundled",
					provenance: {
						type: "official",
					},
				} satisfies SerapackDescriptor,
				config,
				restored: true,
				runRendererEffectFn: Effect.runSync,
				session: {
					readFn: () => Exit.die("No Tick in this fatal/transition fixture"),
					getFatalErrorFn: () => fatal,
					getTransitionSnapshotFn: () => transition,
					subscribeFatalErrorFn: (listener) => {
						fatalListener = listener;
						return () => undefined;
					},
					subscribeTransitionsFn: (listener) => {
						for (let sequence = 317; sequence <= 357; sequence += 1) {
							listener({
								...transition,
								sequence,
							});
						}
						return () => undefined;
					},
				},
			}),
		);

		fatalListener?.();

		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "session-failed",
			data: {
				lastCommitted: {
					sequence: 357,
					events: [
						{
							type: "job:started",
							canonicalItemId: ownerDefinition.id,
							jobId: "job:last",
							ownerItemId,
						},
					],
					runtime: {
						items: [
							{
								item: {
									runtimeItemId: ownerItemId,
									definition: {
										itemId: "producer:finite",
										itemUid: "uid:producer:finite",
									},
								},
								remainingUnits: 0,
							},
						],
						jobs: [
							{
								jobId: "job:last",
								remainingMs: 100,
							},
						],
						queue: requestIds.map((requestId) => ({
							requestId,
							owner: {
								runtimeItemId: ownerItemId,
							},
						})),
					},
				},
				relatedItems: [
					{
						runtimeItemId: ownerItemId,
						definition: {
							itemId: "producer:finite",
							itemUid: "uid:producer:finite",
						},
					},
				],
			},
		});
		expect(writeIncident).toHaveBeenCalledWith(
			expect.objectContaining({
				serapack: expect.objectContaining({
					packageId: "package:test",
				}),
				text: expect.objectContaining({
					incident: expect.stringContaining("# Serakki game incident"),
					failure: expect.stringContaining("config-uid uid:producer:finite"),
					runtimeState: expect.stringContaining("config-uid uid:producer:finite"),
				}),
			}),
		);
		const incident = writeIncident.mock.calls[0]?.[0];
		if (incident === undefined) throw new Error("Expected a failed-session incident.");
		expect(incident.text.runtimeState).not.toContain("Revision:");
		const saved = Effect.runSync(decodeSerakkiSaveFx(incident.saveBytes));
		expect(saved).toMatchObject({
			version: "1.0",
			state: {
				items: [
					expect.objectContaining({
						id: ownerItemId,
						remainingUnits: 0,
					}),
				],
			},
		});
		expect(incident.text.history.match(/^## Sequence /gm)).toHaveLength(32);
		expect(incident.text.history).toContain("## Sequence 326");
		expect(incident.text.history).toContain("## Sequence 357");

		diagnostics.close("discarded");
	});
});
