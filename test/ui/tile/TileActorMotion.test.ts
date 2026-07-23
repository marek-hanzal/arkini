// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileSystem } from "~/ui/tile/TileSystem";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileSurface } from "~/ui/tile/TileSurface";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";
import type { TileActorPose } from "~/ui/tile/useTileNeighbourField";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";

const systemState = vi.hoisted(() => ({
	system: null as TileSystem | null,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/ui/tile/useTileActorSystem", () => ({
	useTileActorSystem: () => {
		if (systemState.system === null) throw new Error("Missing test Tile System.");
		return systemState.system;
	},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
let capturedMotion: ReturnType<typeof useTileActorMotion> | null = null;

const item = (location: useTileActors.Item["location"]): useTileActors.Item => ({
	id: "runtime:water",
	revision: "revision:water",
	itemId: "water",
	title: "Water",
	quantity: 1,
	sourceUrl: "arkini://water",
	location,
	running: false,
	primaryAction: {
		kind: "none",
	},
});

const source = (location: useTileActors.Item["location"]): TileDragSource => {
	const surface: TileSurface =
		location.scope === "board"
			? {
					id: `board:${location.space}`,
					kind: "board",
					space: location.space,
				}
			: location.scope === "inventory"
				? {
						id: "inventory",
						kind: "inventory",
					}
				: {
						id: "toolbar",
						kind: "toolbar",
					};
	return {
		id: "runtime:water",
		revision: "revision:water",
		location,
		surface,
		slot: {
			id: `${location.position.x}:${location.position.y}`,
			x: location.position.x,
			y: location.position.y,
		},
	};
};

const presentation = (
	location: useTileActors.Item["location"],
	generation: number,
): useTileActorPresentation.Model => ({
	canonicalSource: source(location),
	desiredSource: source(location),
	followTarget: null,
	phase: "settling",
	feedback: null,
	forbiddenDrop: false,
	zIndex: 30,
	placementFrozen: false,
	positionCompletion: {
		kind: "location",
		generation,
		location,
	},
	visualCompletionGeneration: null,
	quantityOverride: null,
	hovered: false,
	setHovered: () => undefined,
});

const followingPresentation = ({
	sourceLocation,
	fallbackLocation,
	generation,
	targetItemId = "runtime:target",
}: {
	readonly sourceLocation: useTileActors.Item["location"];
	readonly fallbackLocation: useTileActors.Item["location"];
	readonly generation: number;
	readonly targetItemId?: string;
}): useTileActorPresentation.Model => ({
	...presentation(sourceLocation, generation),
	desiredSource: source(fallbackLocation),
	followTarget: {
		interactionGeneration: generation,
		stage: "approach",
		sourceItemId: "runtime:water",
		targetItemId,
	},
	phase: "combining",
	positionCompletion: {
		kind: "always",
		generation,
	},
});

const Capture = ({
	actor,
	view,
	cue = null,
}: {
	readonly actor: useTileActors.Item;
	readonly view: useTileActorPresentation.Model;
	readonly cue?: TileMotionCueSchema.Type | null;
}) => {
	capturedMotion = useTileActorMotion({
		item: actor,
		presentation: view,
		cue,
	});
	return null;
};

const renderMotion = async (
	actor: useTileActors.Item,
	view: useTileActorPresentation.Model,
	cue: TileMotionCueSchema.Type | null = null,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(Capture, {
				actor,
				view,
				cue,
			}),
		);
	});
	return {
		rerender: async (
			nextView: useTileActorPresentation.Model,
			nextCue: TileMotionCueSchema.Type | null = cue,
		) => {
			await act(async () => {
				root.render(
					createElement(Capture, {
						actor,
						view: nextView,
						cue: nextCue,
					}),
				);
			});
		},
	};
};

beforeEach(() => {
	vi.useFakeTimers();
	motionTestRuntime.reset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	systemState.system = null;
	capturedMotion = null;
	document.body.replaceChildren();
});

describe("useTileActorMotion", () => {
	it("follows the latest exact target pose once and folds contact into a frozen exit", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		motionTestRuntime.deferImperativeValueWrites = true;
		motionTestRuntime.springLag = true;
		let follower: ((pose: TileActorPose | null) => void) | null = null;
		const complete = vi.fn();
		const endNeighbourTravel = vi.fn();
		const beginNeighbourTravel = vi.fn(() => endNeighbourTravel);
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const fallbackLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => ({
				left: 10,
				top: 20,
				width: 800,
				height: 600,
			}),
			readActorRect: () => null,
			readPlacement: (candidate: TileDragSource) => ({
				x: candidate.location.position.x * 100,
				y: candidate.location.position.y * 100,
				width: 100,
				height: 100,
			}),
			followActorPose: (_itemId: string, listener: (pose: TileActorPose | null) => void) => {
				follower = listener;
				return () => {
					if (follower === listener) follower = null;
				};
			},
			complete,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const initialView = {
			...presentation(sourceLocation, 1),
			positionCompletion: {
				kind: "none" as const,
			},
		};
		const rendered = await renderMotion(item(sourceLocation), initialView);
		const anchorIdentity = capturedMotion?.placement.anchor.x;

		await rendered.rerender(
			followingPresentation({
				sourceLocation,
				fallbackLocation,
				generation: 7,
			}),
		);
		const approachAnimations = [
			...motionTestRuntime.imperativeAnimations,
		];
		const approachFollower = follower as ((pose: TileActorPose | null) => void) | null;
		if (approachFollower === null) throw new Error("Missing live target follower.");
		const targetSource = {
			...source(fallbackLocation),
			id: "runtime:target",
			revision: "revision:target",
		};
		const targetPose = (left: number): TileActorPose => ({
			bounds: {
				left,
				top: 20,
				right: left + 100,
				bottom: 120,
				x: left,
				y: 20,
				width: 100,
				height: 100,
				toJSON: () => ({}),
			},
			source: targetSource,
		});

		await act(async () => {
			approachFollower(targetPose(200));
			await vi.advanceTimersByTimeAsync(2_100);
		});
		expect(complete).not.toHaveBeenCalled();
		expect(beginNeighbourTravel).toHaveBeenCalledOnce();
		expect(endNeighbourTravel).not.toHaveBeenCalled();

		await act(async () => {
			for (const animation of approachAnimations) animation.finish();
			await Promise.resolve();
		});
		expect(complete).not.toHaveBeenCalled();

		await act(async () => {
			approachFollower(targetPose(270));
			motionTestRuntime.flushSprings();
			approachFollower(targetPose(270));
			approachFollower(targetPose(270));
		});
		expect(complete).toHaveBeenCalledTimes(1);
		expect(complete).toHaveBeenCalledWith("runtime:water", 7);
		expect(endNeighbourTravel).toHaveBeenCalledOnce();
		expect(capturedMotion?.placement.anchor.x.get()).toBe(100);
		expect(capturedMotion?.travel.x.get()).toBe(160);
		const contactX =
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0);

		await rendered.rerender({
			...presentation(sourceLocation, 7),
			desiredSource: source(fallbackLocation),
			followTarget: null,
			phase: "exiting",
			placementFrozen: true,
			positionCompletion: {
				kind: "none",
			},
			visualCompletionGeneration: 7,
		});
		expect(capturedMotion?.placement.anchor.x).toBe(anchorIdentity);
		expect(
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0),
		).toBe(contactX);

		await act(async () => {
			approachFollower(targetPose(400));
			motionTestRuntime.flushSprings();
		});
		expect(complete).toHaveBeenCalledTimes(1);
		expect(
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0),
		).toBe(contactX);

		const nextAnimationStart = motionTestRuntime.imperativeAnimations.length;
		await rendered.rerender(
			followingPresentation({
				sourceLocation,
				fallbackLocation,
				generation: 8,
				targetItemId: "runtime:next-target",
			}),
		);
		const nextFollower = follower as ((pose: TileActorPose | null) => void) | null;
		if (nextFollower === null || nextFollower === approachFollower) {
			throw new Error("Missing replacement live target follower.");
		}
		await act(async () => {
			approachFollower(targetPose(400));
			motionTestRuntime.flushSprings();
			for (const animation of motionTestRuntime.imperativeAnimations.slice(
				nextAnimationStart,
			)) {
				animation.finish();
			}
			await Promise.resolve();
		});
		expect(complete).toHaveBeenCalledTimes(1);

		const nextTargetPose = {
			...targetPose(220),
			source: {
				...targetSource,
				id: "runtime:next-target",
				revision: "revision:next-target",
			},
		};
		await act(async () => {
			nextFollower(nextTargetPose);
			motionTestRuntime.flushSprings();
			nextFollower(nextTargetPose);
		});
		expect(complete).toHaveBeenCalledTimes(2);
		expect(complete).toHaveBeenLastCalledWith("runtime:water", 8);
		expect(beginNeighbourTravel).toHaveBeenCalledTimes(2);
		expect(endNeighbourTravel).toHaveBeenCalledTimes(2);
	});

	it.each([
		{
			surfaceGone: false,
			terminalX: 320,
			label: "latest exact slot",
		},
		{
			surfaceGone: true,
			terminalX: 100,
			label: "outcome fallback",
		},
	])("settles a removed live target to the $label without a disappearance jump", async ({
		surfaceGone: removeSurface,
		terminalX,
	}) => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		motionTestRuntime.deferImperativeValueWrites = true;
		motionTestRuntime.springLag = true;
		let follower: ((pose: TileActorPose | null) => void) | null = null;
		let surfaceGone = false;
		let geometryVersion = 0;
		let placementOffset = 0;
		const complete = vi.fn();
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const fallbackLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		const latestTargetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		};
		systemState.system = {
			get geometryVersion() {
				return geometryVersion;
			},
			readActorLayerRect: () => ({
				left: 10,
				top: 20,
				width: 800,
				height: 600,
			}),
			readActorRect: () => null,
			readPlacement: (candidate: TileDragSource) =>
				surfaceGone
					? null
					: {
							x: candidate.location.position.x * 100 + placementOffset,
							y: candidate.location.position.y * 100,
							width: 100,
							height: 100,
						},
			followActorPose: (_itemId: string, listener: (pose: TileActorPose | null) => void) => {
				follower = listener;
				return () => {
					if (follower === listener) follower = null;
				};
			},
			complete,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const rendered = await renderMotion(item(sourceLocation), {
			...presentation(sourceLocation, 1),
			positionCompletion: {
				kind: "none",
			},
		});
		const followView = followingPresentation({
			sourceLocation,
			fallbackLocation,
			generation: 11,
		});
		await rendered.rerender(followView);
		const approachAnimations = [
			...motionTestRuntime.imperativeAnimations,
		];
		const approachFollower = follower as ((pose: TileActorPose | null) => void) | null;
		if (approachFollower === null) throw new Error("Missing live target follower.");
		const targetPose: TileActorPose = {
			bounds: {
				left: 310,
				top: 20,
				right: 410,
				bottom: 120,
				x: 310,
				y: 20,
				width: 100,
				height: 100,
				toJSON: () => ({}),
			},
			source: {
				...source(latestTargetLocation),
				id: "runtime:target",
				revision: "revision:target:moved",
			},
		};

		await act(async () => {
			approachFollower(targetPose);
			for (const animation of approachAnimations) animation.finish();
			await Promise.resolve();
		});
		expect(complete).not.toHaveBeenCalled();
		await act(async () => {
			motionTestRuntime.flushSprings();
		});
		expect(
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0),
		).toBe(300);
		expect(complete).not.toHaveBeenCalled();

		surfaceGone = removeSurface;
		if (surfaceGone) {
			geometryVersion += 1;
			await rendered.rerender(followView);
			expect(complete).not.toHaveBeenCalled();
		}
		const fallbackAnimationStart = motionTestRuntime.imperativeAnimations.length;
		await act(async () => {
			approachFollower(null);
		});
		const fallbackAnimations =
			motionTestRuntime.imperativeAnimations.slice(fallbackAnimationStart);
		expect(fallbackAnimations).toHaveLength(4);
		expect(
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0),
		).toBe(300);
		expect(complete).not.toHaveBeenCalled();

		placementOffset = 20;
		geometryVersion += 1;
		const retargetedFallbackStart = motionTestRuntime.imperativeAnimations.length;
		await rendered.rerender(followView);
		const retargetedFallbackAnimations =
			motionTestRuntime.imperativeAnimations.slice(retargetedFallbackStart);
		expect(retargetedFallbackAnimations).toHaveLength(4);
		expect(fallbackAnimations.every((animation) => animation.stopped())).toBe(true);
		expect(
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0),
		).toBe(300);

		await act(async () => {
			for (const animation of fallbackAnimations) animation.finish();
			await Promise.resolve();
		});
		expect(complete).not.toHaveBeenCalled();

		await act(async () => {
			for (const animation of retargetedFallbackAnimations) animation.finish();
			await Promise.resolve();
		});
		expect(complete).toHaveBeenCalledOnce();
		expect(complete).toHaveBeenCalledWith("runtime:water", 11);
		expect(
			(capturedMotion?.placement.anchor.x.get() ?? 0) + (capturedMotion?.travel.x.get() ?? 0),
		).toBe(terminalX);
	});

	it("arms one spawn Enter only after the latest retargeted delivery controls finish", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		let geometryVersion = 0;
		let placement = {
			x: 200,
			y: 20,
			width: 100,
			height: 100,
		};
		systemState.system = {
			get geometryVersion() {
				return geometryVersion;
			},
			readActorLayerRect: () => ({
				left: 0,
				top: 0,
				width: 800,
				height: 600,
			}),
			readActorRect: (itemId: string) =>
				itemId === "runtime:producer"
					? {
							left: 0,
							top: 20,
							width: 100,
							height: 100,
						}
					: null,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		};
		const cue: TileMotionCueSchema.Type = {
			generation: 41,
			kind: "spawn",
			originItemId: "runtime:producer",
			producerEmissionId: "emission:41",
			producerEmissionReleased: true,
			strength: 1,
		};
		const rendered = await renderMotion(item(location), presentation(location, 1), cue);
		const originalDelivery = motionTestRuntime.imperativeAnimations.slice();

		expect(originalDelivery).toHaveLength(2);
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(false);

		placement = {
			x: 320,
			y: 40,
			width: 120,
			height: 110,
		};
		geometryVersion += 1;
		await rendered.rerender(presentation(location, 1), cue);
		const replacementDelivery = motionTestRuntime.imperativeAnimations.slice(2);

		expect(originalDelivery.every((animation) => animation.stopped())).toBe(true);
		expect(replacementDelivery).toHaveLength(4);
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(false);

		await act(async () => {
			for (const animation of originalDelivery) animation.finish();
			await Promise.resolve();
		});
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(false);

		await act(async () => {
			for (const animation of replacementDelivery) animation.finish();
			await Promise.resolve();
		});
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(true);

		await act(async () => {
			for (const animation of originalDelivery) animation.finish();
			await Promise.resolve();
		});
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(true);
	});

	it("starts exact-origin delivery when the captured spawn arrives after actor initialization", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		const placement = {
			x: 240,
			y: 0,
			width: 100,
			height: 100,
		};
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => ({
				left: 0,
				top: 0,
				width: 800,
				height: 600,
			}),
			readActorRect: (itemId: string) =>
				itemId === "runtime:producer"
					? {
							left: 0,
							top: 0,
							width: 100,
							height: 100,
						}
					: null,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		};
		const view = presentation(location, 1);
		const rendered = await renderMotion(item(location), view);

		expect(motionTestRuntime.imperativeAnimations).toHaveLength(0);
		await rendered.rerender(view, {
			generation: 51,
			kind: "spawn",
			originItemId: "runtime:producer",
			producerEmissionId: "emission:51",
			producerEmissionReleased: true,
			strength: 1,
		});
		const delivery = motionTestRuntime.imperativeAnimations.slice();

		expect(delivery).toHaveLength(2);
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(false);
		expect(capturedMotion?.travel.spawnDeliveryTiming?.distance).toBe(201);

		await act(async () => {
			for (const animation of delivery) animation.finish();
			await Promise.resolve();
		});
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(true);
	});

	it("anchors a collapse spawn at the producer center instead of its directional mouth", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		const placement = {
			x: 240,
			y: 0,
			width: 100,
			height: 100,
		};
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => ({
				left: 0,
				top: 0,
				width: 800,
				height: 600,
			}),
			readActorRect: () => ({
				left: 0,
				top: 0,
				width: 100,
				height: 100,
			}),
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		};

		await renderMotion(item(location), presentation(location, 1), {
			generation: 52,
			kind: "spawn",
			originItemId: "runtime:producer",
			producerEmissionId: "emission:52",
			emissionFromCollapse: true,
			producerEmissionReleased: true,
			strength: 1,
		});

		expect(capturedMotion?.travel.spawnDeliveryTiming?.distance).toBe(240);
	});

	it("holds a producer output and remeasures geometry when its exact release arrives", async () => {
		const placement = {
			x: 240,
			y: 0,
			width: 100,
			height: 100,
		};
		let originRect: {
			readonly left: number;
			readonly top: number;
			readonly width: number;
			readonly height: number;
		} | null = null;
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => ({
				left: 0,
				top: 0,
				width: 800,
				height: 600,
			}),
			readActorRect: () => originRect,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		};

		const pendingCue: TileMotionCueSchema.Type = {
			generation: 61,
			kind: "spawn",
			originItemId: "runtime:missing-producer",
			producerEmissionId: "emission:61",
			strength: 1,
		};
		const rendered = await renderMotion(item(location), presentation(location, 1), pendingCue);

		expect(motionTestRuntime.imperativeAnimations).toHaveLength(0);
		expect(capturedMotion?.travel.spawnDeliveryTiming).toBeNull();
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(false);

		originRect = {
			left: 0,
			top: 0,
			width: 100,
			height: 100,
		};
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		await rendered.rerender(presentation(location, 1), {
			...pendingCue,
			producerEmissionReleased: true,
		});

		expect(motionTestRuntime.imperativeAnimations).toHaveLength(2);
		expect(capturedMotion?.travel.spawnDeliveryReady).toBe(false);
	});

	it("keeps pending spatial controls across cue-only and unchanged geometry publications", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		let geometryVersion = 0;
		const placement = {
			x: 100,
			y: 0,
			width: 100,
			height: 100,
		};
		const system = {
			get geometryVersion() {
				return geometryVersion;
			},
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		systemState.system = system;
		const currentLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		const initialView = {
			...presentation(currentLocation, 1),
			positionCompletion: {
				kind: "none" as const,
			},
		};
		const rendered = await renderMotion(item(currentLocation), initialView);
		await rendered.rerender(presentation(targetLocation, 2));
		const pending = [
			...motionTestRuntime.imperativeAnimations,
		];
		expect(pending.length).toBeGreaterThan(0);

		const cue: TileMotionCueSchema.Type = {
			generation: 10,
			kind: "impact",
			strength: 1,
		};
		await rendered.rerender(presentation(targetLocation, 2), cue);
		expect(motionTestRuntime.imperativeAnimations).toHaveLength(pending.length);
		expect(pending.every((animation) => !animation.stopped())).toBe(true);

		geometryVersion += 1;
		await rendered.rerender(presentation(targetLocation, 2), cue);
		expect(motionTestRuntime.imperativeAnimations).toHaveLength(pending.length);
		expect(pending.every((animation) => !animation.stopped())).toBe(true);
	});

	it("invalidates stale travel for an unmeasured new destination without stopping the current intent", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		let geometryVersion = 0;
		let measured: {
			readonly x: number;
			readonly y: number;
			readonly width: number;
			readonly height: number;
		} | null = {
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		let measurementError: Error | null = null;
		systemState.system = {
			get geometryVersion() {
				return geometryVersion;
			},
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => {
				if (measurementError !== null) throw measurementError;
				return measured;
			},
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const locationA = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const locationB = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		const locationC = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		};
		const initialView = {
			...presentation(locationA, 1),
			positionCompletion: {
				kind: "none" as const,
			},
		};
		const rendered = await renderMotion(item(locationA), initialView);

		measured = {
			x: 100,
			y: 0,
			width: 100,
			height: 100,
		};
		await rendered.rerender(presentation(locationB, 2));
		const destinationBAnimations = [
			...motionTestRuntime.imperativeAnimations,
		];
		expect(destinationBAnimations).toHaveLength(4);

		measured = null;
		await rendered.rerender(presentation(locationC, 3));
		expect(destinationBAnimations.every((animation) => animation.stopped())).toBe(true);
		expect(motionTestRuntime.imperativeAnimations).toHaveLength(4);

		measured = {
			x: 200,
			y: 0,
			width: 100,
			height: 100,
		};
		geometryVersion += 1;
		await rendered.rerender(presentation(locationC, 3));
		const destinationCAnimations = motionTestRuntime.imperativeAnimations.slice(4);
		expect(destinationCAnimations).toHaveLength(4);
		expect(destinationCAnimations.every((animation) => !animation.stopped())).toBe(true);

		measurementError = new Error("same target measurement failed");
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		geometryVersion += 1;
		await rendered.rerender(presentation(locationC, 3));
		expect(motionTestRuntime.imperativeAnimations).toHaveLength(8);
		expect(destinationCAnimations.every((animation) => !animation.stopped())).toBe(true);
	});

	it("keeps direct pointer translation separate from transient travel", async () => {
		motionTestRuntime.springLag = true;
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			}),
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};

		await renderMotion(item(location), presentation(location, 1));
		if (capturedMotion === null) throw new Error("Tile actor motion was not captured.");
		capturedMotion.pointer.values.direct.x.set(100);
		capturedMotion.pointer.values.direct.y.set(-100);

		expect(capturedMotion.pointer.values.direct.x.get()).toBe(100);
		expect(capturedMotion.pointer.values.direct.y.get()).toBe(-100);
		expect(capturedMotion.travel.x.get()).toBe(0);
		expect(capturedMotion.travel.y.get()).toBe(0);
	});

	it("hands released pointer translation to travel without changing the visible offset", async () => {
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			}),
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};

		await renderMotion(item(location), presentation(location, 1));
		if (capturedMotion === null) throw new Error("Tile actor motion was not captured.");
		capturedMotion.pointer.commands.armPickup({
			x: -20,
			y: 10,
		});
		capturedMotion.pointer.commands.startPickup();
		capturedMotion.pointer.values.direct.x.set(80);
		capturedMotion.pointer.values.direct.y.set(-40);

		const before = {
			x:
				capturedMotion.travel.x.get() +
				capturedMotion.pointer.values.direct.x.get() +
				capturedMotion.pointer.values.pickup.x.get(),
			y:
				capturedMotion.travel.y.get() +
				capturedMotion.pointer.values.direct.y.get() +
				capturedMotion.pointer.values.pickup.y.get(),
		};
		const snapshot = capturedMotion.pointer.commands.release(7);

		expect(snapshot.interactionGeneration).toBe(7);
		expect(capturedMotion.pointer.values.direct.x.get()).toBe(0);
		expect(capturedMotion.pointer.values.direct.y.get()).toBe(0);
		expect(capturedMotion.pointer.values.pickup.x.get()).toBe(0);
		expect(capturedMotion.pointer.values.pickup.y.get()).toBe(0);
		expect({
			x: capturedMotion.travel.x.get(),
			y: capturedMotion.travel.y.get(),
		}).toEqual(before);
	});

	it("owns crowd travel for real spatial settlement and releases the exact mover", async () => {
		const beginNeighbourTravel = vi.fn();
		const endNeighbourTravel = vi.fn();
		beginNeighbourTravel.mockReturnValue(endNeighbourTravel);
		let placement = {
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const currentLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		const rendered = await renderMotion(
			item(currentLocation),
			presentation(currentLocation, 1),
		);

		placement = {
			x: 100,
			y: 0,
			width: 100,
			height: 100,
		};
		await rendered.rerender(presentation(targetLocation, 2));
		await act(async () => undefined);

		expect(beginNeighbourTravel).toHaveBeenCalledOnce();
		expect(beginNeighbourTravel).toHaveBeenCalledWith("runtime:water");
		expect(endNeighbourTravel).toHaveBeenCalledOnce();
	});

	it("does not create crowd travel for unchanged semantic placement", async () => {
		const beginNeighbourTravel = vi.fn(() => vi.fn());
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			}),
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const rendered = await renderMotion(item(location), presentation(location, 1));

		await rendered.rerender(presentation(location, 2));
		await act(async () => undefined);

		expect(beginNeighbourTravel).not.toHaveBeenCalled();
	});

	it("releases exact position ownership when placement remains unavailable", async () => {
		const complete = vi.fn();
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => null,
			complete,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const currentLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		const rendered = await renderMotion(item(currentLocation), presentation(targetLocation, 7));

		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).not.toHaveBeenCalled();

		await rendered.rerender(presentation(targetLocation, 8));
		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).toHaveBeenCalledTimes(1);
		expect(complete).toHaveBeenCalledWith("runtime:water", 8);
	});

	it("converges immediately when measurement fails after canonical location already committed", async () => {
		const complete = vi.fn();
		const error = new Error("measurement failed");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => {
				throw error;
			},
			complete,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "inventory" as const,
			position: {
				x: 1,
				y: 0,
			},
		};

		await renderMotion(item(location), presentation(location, 12));

		expect(complete).toHaveBeenCalledWith("runtime:water", 12);
		expect(consoleError).toHaveBeenCalledWith(
			"Tile placement measurement failed; keeping its last stable pose.",
			error,
		);
	});

	it("rejects a stale visual completion callback and resets its fallback generation", async () => {
		const complete = vi.fn();
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			}),
			complete,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const visualPresentation = (generation: number): useTileActorPresentation.Model => ({
			...presentation(location, generation),
			positionCompletion: {
				kind: "none",
			},
			visualCompletionGeneration: generation,
		});
		const rendered = await renderMotion(item(location), visualPresentation(7));
		if (capturedMotion === null) throw new Error("Tile actor motion was not captured.");
		const staleCompletion = capturedMotion.completion.onVisualComplete;

		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		await rendered.rerender(visualPresentation(8));
		staleCompletion();
		expect(complete).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).toHaveBeenCalledOnce();
		expect(complete).toHaveBeenCalledWith("runtime:water", 8);
	});
});
