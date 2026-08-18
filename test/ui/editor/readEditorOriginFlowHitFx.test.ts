import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginFlow,
	type EditorItemOriginItemNode,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import { readEditorOriginFlowHitFx } from "~/ui/item/editor/readEditorOriginFlowHitFx";
import { readEditorOriginFlowNodeMetricsFx } from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";
import type { EditorItemOriginFlowLayoutNode } from "~/ui/item/editor/editorItemOriginFlowLayout";

const node = (itemId: string): EditorItemOriginItemNode => ({
	id: `item:${itemId}`,
	itemId,
	operations: [],
	resourceIds: [
		`asset:${itemId}`,
	],
	starterScopes: [],
	title: itemId,
	type: "simple" as const,
});

describe("readEditorOriginFlowHitFx", () => {
	it("follows both aggregate item ports through their connected graph edge", () => {
		const source = node("source");
		const preferredSource = node("preferred-source");
		const item = node("item");
		const target = node("target");
		const flow: EditorItemOriginFlow = {
			edges: [
				{
					id: "z-incoming",
					operationId: "make-item",
					role: "output",
					source: source.id,
					sourcePortId: "make-item:output",
					target: item.id,
					targetPortId: EditorItemOriginItemInputPortId,
				},
				{
					id: "a-incoming",
					operationId: "make-preferred-item",
					role: "output",
					source: preferredSource.id,
					sourcePortId: "make-preferred-item:output",
					target: item.id,
					targetPortId: EditorItemOriginItemInputPortId,
				},
				{
					id: "outgoing",
					operationId: "use-item",
					role: "input",
					source: item.id,
					sourcePortId: EditorItemOriginItemOutputPortId,
					target: target.id,
					targetPortId: "use-item:input",
				},
			],
			nodes: [
				source,
				preferredSource,
				item,
				target,
			],
		};
		const metrics = Effect.runSync(readEditorOriginFlowNodeMetricsFx(item));
		const position: EditorItemOriginFlowLayoutNode = {
			flowOrder: 0,
			height: metrics.height,
			width: metrics.width,
			x: 100,
			y: 200,
		};
		const positions = new Map([
			[
				source.id,
				{
					...position,
					x: -500,
				},
			],
			[
				preferredSource.id,
				{
					...position,
					x: -900,
				},
			],
			[
				item.id,
				position,
			],
			[
				target.id,
				{
					...position,
					x: 700,
				},
			],
		]);
		const connectedPorts = new Map([
			[
				item.id,
				new Set([
					EditorItemOriginItemInputPortId,
					EditorItemOriginItemOutputPortId,
				]),
			],
		]);
		const readHit = (x: number, y = position.y + metrics.itemPortY) =>
			Effect.runSync(
				readEditorOriginFlowHitFx({
					backbones: new Map(),
					connectedPorts,
					flow,
					highlight: undefined,
					metroBackbones: new Map(),
					nodeMetrics: new Map([
						[
							item.id,
							metrics,
						],
					]),
					positions,
					selection: undefined,
					x,
					y,
					zoom: 1,
				}),
			);

		expect(readHit(position.x)).toEqual({
			kind: "port",
			targetNodeId: preferredSource.id,
		});
		expect(readHit(position.x + position.width)).toEqual({
			kind: "port",
			targetNodeId: target.id,
		});
		expect(
			readHit(
				position.x + metrics.itemTextBounds.x + 1,
				position.y + metrics.itemTextBounds.y + 1,
			),
		).toEqual({
			itemId: item.itemId,
			kind: "item-detail",
		});
		expect(readHit(position.x + 20, position.y + 20)).toEqual({
			id: item.id,
			kind: "node",
		});
	});
});
