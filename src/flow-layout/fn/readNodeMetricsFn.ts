import {
	ItemOriginItemInputPortId,
	ItemOriginItemOutputPortId,
	type ItemOriginItemNode,
	type ItemOriginOperation,
} from "~/flow/type/ItemOriginFlow";

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

const readItemPortYFn = (headerHeight: number) =>
	ItemPortBaseY + (headerHeight - NodeHeaderHeight) / 2;

interface OperationMetrics {
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

const readOperationBodyHeightFn = (operation: ItemOriginOperation) =>
	Math.max(1, operation.inputs.length, operation.outputs.length) * PortLineHeight;

const readOperationHeightFn = (operation: ItemOriginOperation) =>
	OperationContentPadding * 2 +
	OperationHeaderHeight +
	OperationHeaderGap +
	readOperationBodyHeightFn(operation);

const readPortYsFn = (
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
export const readNodeMetricsFn = (node: ItemOriginItemNode): NodeMetrics => {
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
			itemPortY: readItemPortYFn(NodeMinHeight),
			itemTextBounds,
			operations: [],
			portOffsets: new Map([
				[
					ItemOriginItemInputPortId,
					{
						x: -NodeWidth / 2,
						y: readItemPortYFn(NodeMinHeight) - NodeMinHeight / 2,
					},
				],
				[
					ItemOriginItemOutputPortId,
					{
						x: NodeWidth / 2,
						y: readItemPortYFn(NodeMinHeight) - NodeMinHeight / 2,
					},
				],
			]),
			width: NodeWidth,
		};
	}

	let top = NodeHeaderHeight;
	const operations: OperationMetrics[] = [];
	for (const operation of node.operations) {
		const height = readOperationHeightFn(operation);
		const bodyHeight = readOperationBodyHeightFn(operation);
		const bodyTop = top + OperationContentPadding + OperationHeaderHeight + OperationHeaderGap;
		operations.push({
			height,
			id: operation.id,
			inputPortYs: readPortYsFn(operation.inputs, bodyTop, bodyHeight),
			outputPortYs: readPortYsFn(operation.outputs, bodyTop, bodyHeight),
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
	portOffsets.set(ItemOriginItemInputPortId, {
		x: -NodeWidth / 2,
		y: readItemPortYFn(NodeHeaderHeight) - height / 2,
	});
	portOffsets.set(ItemOriginItemOutputPortId, {
		x: NodeWidth / 2,
		y: readItemPortYFn(NodeHeaderHeight) - height / 2,
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
		itemPortY: readItemPortYFn(NodeHeaderHeight),
		itemTextBounds,
		operations,
		portOffsets,
		width: NodeWidth,
	};
};
