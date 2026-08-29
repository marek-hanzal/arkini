import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
} from "~/flow/domain/EditorItemOriginFlow";

const NodeWidth = 420;
const NodeMinHeight = 176;
const NodeHeaderHeight = 132;
const OperationGap = 8;
export const OperationSidePadding = 12;
export const OperationContentPadding = 12;
export const OperationHeaderHeight = 22;
const OperationHeaderGap = 8;

const PortLineHeight = 26;
const NodeBottomPadding = 12;
const ItemPortBaseY = 45;

const readItemPortY = (headerHeight: number) =>
	ItemPortBaseY + (headerHeight - NodeHeaderHeight) / 2;

export interface OperationMetrics {
	readonly height: number;
	readonly id: string;
	readonly inputPortYs: ReadonlyMap<string, number>;
	readonly outputPortYs: ReadonlyMap<string, number>;
	readonly top: number;
}

export interface NodeMetrics {
	readonly headerHeight: number;
	readonly height: number;
	readonly itemPortY: number;
	readonly itemTextBounds: {
		readonly height: number;
		readonly width: number;
		readonly x: number;
		readonly y: number;
	};
	readonly operations: ReadonlyArray<OperationMetrics>;
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
	OperationContentPadding * 2 +
	OperationHeaderHeight +
	OperationHeaderGap +
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
export const readNodeMetricsFn = (node: EditorItemOriginItemNode): NodeMetrics => {
	const itemTextBounds = {
		height: node.operations.length === 0 ? NodeMinHeight : NodeHeaderHeight,
		width: NodeWidth - 120,
		x: 102,
		y: 0,
	};
	if (node.operations.length === 0) {
		return {
			headerHeight: NodeMinHeight,
			height: NodeMinHeight,
			itemPortY: readItemPortY(NodeMinHeight),
			itemTextBounds,
			operations: [],
			portOffsets: new Map([
				[
					EditorItemOriginItemInputPortId,
					{
						x: -NodeWidth / 2,
						y: readItemPortY(NodeMinHeight) - NodeMinHeight / 2,
					},
				],
				[
					EditorItemOriginItemOutputPortId,
					{
						x: NodeWidth / 2,
						y: readItemPortY(NodeMinHeight) - NodeMinHeight / 2,
					},
				],
			]),
			width: NodeWidth,
		};
	}

	let top = NodeHeaderHeight;
	const operations: OperationMetrics[] = [];
	for (const operation of node.operations) {
		const height = readOperationHeight(operation);
		const bodyHeight = readOperationBodyHeight(operation);
		const bodyTop = top + OperationContentPadding + OperationHeaderHeight + OperationHeaderGap;
		operations.push({
			height,
			id: operation.id,
			inputPortYs: readPortYs(operation.inputs, bodyTop, bodyHeight),
			outputPortYs: readPortYs(operation.outputs, bodyTop, bodyHeight),
			top,
		});
		top += height + OperationGap;
	}
	const height = Math.max(NodeMinHeight, top - OperationGap + NodeBottomPadding);
	const portOffsets = new Map<
		string,
		{
			readonly x: number;
			readonly y: number;
		}
	>();
	portOffsets.set(EditorItemOriginItemInputPortId, {
		x: -NodeWidth / 2,
		y: readItemPortY(NodeHeaderHeight) - height / 2,
	});
	portOffsets.set(EditorItemOriginItemOutputPortId, {
		x: NodeWidth / 2,
		y: readItemPortY(NodeHeaderHeight) - height / 2,
	});
	for (const operation of operations) {
		for (const [portId, y] of operation.inputPortYs) {
			portOffsets.set(portId, {
				x: -NodeWidth / 2,
				y: y - height / 2,
			});
		}
		for (const [portId, y] of operation.outputPortYs) {
			portOffsets.set(portId, {
				x: NodeWidth / 2,
				y: y - height / 2,
			});
		}
	}
	return {
		headerHeight: NodeHeaderHeight,
		height,
		itemPortY: readItemPortY(NodeHeaderHeight),
		itemTextBounds,
		operations,
		portOffsets,
		width: NodeWidth,
	};
};
