import { Effect } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
} from "~/bridge/item/editor/EditorItemOriginFlow";

const EditorOriginFlowNodeWidth = 420;
const EditorOriginFlowNodeMinHeight = 176;
const EditorOriginFlowNodeHeaderHeight = 132;
const EditorOriginFlowOperationGap = 8;
export const EditorOriginFlowOperationSidePadding = 12;
export const EditorOriginFlowOperationContentPadding = 12;
export const EditorOriginFlowOperationHeaderHeight = 22;
const EditorOriginFlowOperationHeaderGap = 8;

const PortLineHeight = 26;
const NodeBottomPadding = 12;
const EditorOriginFlowItemPortBaseY = 45;

const readEditorOriginFlowItemPortY = (headerHeight: number) =>
	EditorOriginFlowItemPortBaseY + (headerHeight - EditorOriginFlowNodeHeaderHeight) / 2;

export interface EditorOriginFlowOperationMetrics {
	readonly height: number;
	readonly id: string;
	readonly inputPortYs: ReadonlyMap<string, number>;
	readonly outputPortYs: ReadonlyMap<string, number>;
	readonly top: number;
}

export interface EditorOriginFlowNodeMetrics {
	readonly headerHeight: number;
	readonly height: number;
	readonly itemPortY: number;
	readonly operations: ReadonlyArray<EditorOriginFlowOperationMetrics>;
	readonly portOffsets: ReadonlyMap<
		string,
		{
			readonly x: number;
			readonly y: number;
		}
	>;
	readonly width: number;
}

const readOperationBodyHeight = (operation: EditorItemOriginOperation) =>
	Math.max(1, operation.inputs.length, operation.outputs.length) * PortLineHeight;

const readOperationHeight = (operation: EditorItemOriginOperation) =>
	EditorOriginFlowOperationContentPadding * 2 +
	EditorOriginFlowOperationHeaderHeight +
	EditorOriginFlowOperationHeaderGap +
	readOperationBodyHeight(operation);

const readPortYs = (
	ports: ReadonlyArray<{
		readonly id: string;
	}>,
	top: number,
	height: number,
): ReadonlyMap<string, number> => {
	if (ports.length === 0) return new Map();
	const contentHeight = ports.length * PortLineHeight;
	const firstCenter = top + (height - contentHeight) / 2 + PortLineHeight / 2;
	return new Map(
		ports.map((port, index) => [
			port.id,
			firstCenter + index * PortLineHeight,
		]),
	);
};

/** Shared flow-canvas geometry for variable-height item cards and their embedded operation ports. */
export const readEditorOriginFlowNodeMetricsFx = Effect.fn("readEditorOriginFlowNodeMetricsFx")(
	(node: EditorItemOriginItemNode) =>
		Effect.sync((): EditorOriginFlowNodeMetrics => {
			if (node.operations.length === 0) {
				return {
					headerHeight: EditorOriginFlowNodeMinHeight,
					height: EditorOriginFlowNodeMinHeight,
					itemPortY: readEditorOriginFlowItemPortY(EditorOriginFlowNodeMinHeight),
					operations: [],
					portOffsets: new Map([
						[
							EditorItemOriginItemInputPortId,
							{
								x: -EditorOriginFlowNodeWidth / 2,
								y:
									readEditorOriginFlowItemPortY(EditorOriginFlowNodeMinHeight) -
									EditorOriginFlowNodeMinHeight / 2,
							},
						],
						[
							EditorItemOriginItemOutputPortId,
							{
								x: EditorOriginFlowNodeWidth / 2,
								y:
									readEditorOriginFlowItemPortY(EditorOriginFlowNodeMinHeight) -
									EditorOriginFlowNodeMinHeight / 2,
							},
						],
					]),
					width: EditorOriginFlowNodeWidth,
				};
			}

			let top = EditorOriginFlowNodeHeaderHeight;
			const operations: EditorOriginFlowOperationMetrics[] = [];
			for (const operation of node.operations) {
				const height = readOperationHeight(operation);
				const bodyHeight = readOperationBodyHeight(operation);
				const bodyTop =
					top +
					EditorOriginFlowOperationContentPadding +
					EditorOriginFlowOperationHeaderHeight +
					EditorOriginFlowOperationHeaderGap;
				operations.push({
					height,
					id: operation.id,
					inputPortYs: readPortYs(operation.inputs, bodyTop, bodyHeight),
					outputPortYs: readPortYs(operation.outputs, bodyTop, bodyHeight),
					top,
				});
				top += height + EditorOriginFlowOperationGap;
			}
			const height = Math.max(
				EditorOriginFlowNodeMinHeight,
				top - EditorOriginFlowOperationGap + NodeBottomPadding,
			);
			const portOffsets = new Map<
				string,
				{
					readonly x: number;
					readonly y: number;
				}
			>();
			portOffsets.set(EditorItemOriginItemInputPortId, {
				x: -EditorOriginFlowNodeWidth / 2,
				y: readEditorOriginFlowItemPortY(EditorOriginFlowNodeHeaderHeight) - height / 2,
			});
			portOffsets.set(EditorItemOriginItemOutputPortId, {
				x: EditorOriginFlowNodeWidth / 2,
				y: readEditorOriginFlowItemPortY(EditorOriginFlowNodeHeaderHeight) - height / 2,
			});
			for (const operation of operations) {
				for (const [portId, y] of operation.inputPortYs) {
					portOffsets.set(portId, {
						x: -EditorOriginFlowNodeWidth / 2,
						y: y - height / 2,
					});
				}
				for (const [portId, y] of operation.outputPortYs) {
					portOffsets.set(portId, {
						x: EditorOriginFlowNodeWidth / 2,
						y: y - height / 2,
					});
				}
			}
			return {
				headerHeight: EditorOriginFlowNodeHeaderHeight,
				height,
				itemPortY: readEditorOriginFlowItemPortY(EditorOriginFlowNodeHeaderHeight),
				operations,
				portOffsets,
				width: EditorOriginFlowNodeWidth,
			};
		}),
);
