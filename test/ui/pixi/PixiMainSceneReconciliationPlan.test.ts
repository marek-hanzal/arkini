import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiMainSceneVisibleActor } from "~/ui/pixi/scene/classifyPixiMainSceneReconciliation";
import {
	classifyPixiMainSceneActorUpdate,
	classifyPixiMainSceneReconciliation,
} from "~/ui/pixi/scene/classifyPixiMainSceneReconciliation";

const boardLocation = (x: number): TileActorItem["location"] => ({
	scope: "board",
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const actorItem = (id: string, overrides: Partial<TileActorItem> = {}): TileActorItem => ({
	activityEffect: false,
	compositeUrl: undefined,
	footprint: {
		height: 1,
		width: 1,
	},
	id,
	itemId: "water",
	itemType: "simple",
	location: boardLocation(0),
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: `revision:${id}`,
	running: false,
	sourceUrl: "resource:water",
	title: "Water",
	...overrides,
});

const visibleActor = (id: string): PixiMainSceneVisibleActor => ({
	item: {
		id,
	} as TileActorItem,
	pose: {
		height: 80,
		layer: null as never,
		size: 80,
		width: 80,
		x: 40,
		y: 60,
	},
});

describe("Pixi main-scene reconciliation classification", () => {
	it("classifies every update decision before actor mutation begins", () => {
		const current = actorItem("update");
		const displayItem = actorItem(current.id, {
			activityEffect: true,
			location: boardLocation(1),
			revision: "revision:update:next",
			running: true,
		});
		const actor = {
			container: {
				scale: {
					x: 1.25,
					y: 1.25,
				},
				x: 40,
				y: 60,
			},
			currentVisual: {
				item: current,
			},
			dragging: false,
			item: current,
			size: 80,
			height: 80,
			width: 80,
		} as PixiTileActor;

		expect(
			classifyPixiMainSceneActorUpdate({
				actor,
				deliveryRetained: false,
				directLanding: true,
				displayItem,
				motionClaimed: false,
				pose: {
					height: 100,
					layer: null as never,
					size: 100,
					width: 100,
					x: 140,
					y: 60,
				},
				poseChannelActive: false,
				preserveVisual: true,
			}),
		).toEqual({
			activityEffect: "start",
			crowdAlpha: 0.82,
			item: {
				kind: "visual",
				preserveVisual: true,
				size: 100,
			},
			pose: {
				directLanding: true,
				kind: "travel",
				scaleBeforeTravel: {
					x: 1,
					y: 1,
				},
			},
		});
	});

	it("updates canonical visuals without stealing a delivery-owned pose", () => {
		const current = actorItem("delivery");
		const displayItem = actorItem(current.id, {
			revision: "revision:delivery:next",
		});
		const actor = {
			container: {
				scale: {
					x: 1,
				},
				x: 40,
				y: 60,
			},
			currentVisual: {
				item: current,
			},
			dragging: false,
			item: current,
			size: 80,
		} as PixiTileActor;

		expect(
			classifyPixiMainSceneActorUpdate({
				actor,
				deliveryRetained: true,
				directLanding: false,
				displayItem,
				motionClaimed: false,
				pose: {
					height: 100,
					layer: null as never,
					size: 100,
					width: 100,
					x: 140,
					y: 60,
				},
				poseChannelActive: false,
				preserveVisual: false,
			}),
		).toEqual({
			activityEffect: null,
			crowdAlpha: null,
			item: {
				kind: "visual",
				preserveVisual: false,
				size: 80,
			},
			pose: {
				kind: "owned",
			},
		});
	});

	it("classifies same-frame add, update, immediate removal, retained, and animated exit work", () => {
		const plan = classifyPixiMainSceneReconciliation({
			actorIds: [
				"update",
				"inventory",
				"hidden",
				"pending",
				"delivery",
				"motion",
				"feedback",
				"removed",
			],
			deliveryRetainedActorIds: new Set([
				"delivery",
			]),
			feedbackCues: [
				{
					actorId: "feedback",
					key: "feedback:consume",
					kind: "consume",
				},
			],
			hiddenActorIds: new Set([
				"hidden",
			]),
			inventoryActorIds: new Set([
				"inventory",
			]),
			motionRetainedActorIds: new Set([
				"motion",
			]),
			pendingActorIds: new Set([
				"pending",
			]),
			visibleActors: new Map([
				[
					"update",
					visibleActor("update"),
				],
				[
					"add",
					visibleActor("add"),
				],
			]),
		});

		expect(
			plan.arrivals.map(({ kind, visible }) => [
				kind,
				visible.item.id,
			]),
		).toEqual([
			[
				"update",
				"update",
			],
			[
				"add",
				"add",
			],
		]);
		expect(plan.departures).toEqual([
			{
				actorId: "inventory",
				kind: "remove-immediately",
			},
			{
				actorId: "hidden",
				kind: "release-hidden",
			},
			{
				actorId: "feedback",
				feedbackCues: [
					{
						actorId: "feedback",
						key: "feedback:consume",
						kind: "consume",
					},
				],
				kind: "release",
				style: "feedback-particles",
			},
			{
				actorId: "removed",
				feedbackCues: [],
				kind: "release",
				style: "default",
			},
		]);
	});

	it("returns an identical plan for an identical presentation snapshot", () => {
		const props = {
			actorIds: [
				"update",
				"removed",
			],
			deliveryRetainedActorIds: new Set<string>(),
			feedbackCues: [],
			hiddenActorIds: new Set<string>(),
			inventoryActorIds: new Set<string>(),
			motionRetainedActorIds: new Set<string>(),
			pendingActorIds: new Set<string>(),
			visibleActors: new Map([
				[
					"update",
					visibleActor("update"),
				],
				[
					"add",
					visibleActor("add"),
				],
			]),
		};

		expect(classifyPixiMainSceneReconciliation(props)).toEqual(
			classifyPixiMainSceneReconciliation(props),
		);
	});
});
