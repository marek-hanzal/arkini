import type {
	EditorItemOriginItemNode,
	EditorItemOriginOperation,
} from "~/bridge/item/editor/readEditorItemOriginFlow";

export const EditorOriginFlowNodeWidth = 420;
export const EditorOriginFlowNodeMinHeight = 176;
export const EditorOriginFlowNodeHeaderHeight = 132;
export const EditorOriginFlowOperationGap = 8;
export const EditorOriginFlowOperationSidePadding = 12;
export const EditorOriginFlowOperationContentPadding = 12;
export const EditorOriginFlowOperationHeaderHeight = 22;
export const EditorOriginFlowOperationHeaderGap = 8;

const PortLineHeight = 26;
const NodeBottomPadding = 12;

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

/** Shared Canvas/MSAGL geometry for variable-height item cards and their embedded operation ports. */
export const readEditorOriginFlowNodeMetrics = (
	node: EditorItemOriginItemNode,
): EditorOriginFlowNodeMetrics => {
	if (node.operations.length === 0) {
		return {
			headerHeight: EditorOriginFlowNodeMinHeight,
			height: EditorOriginFlowNodeMinHeight,
			operations: [],
			portOffsets: new Map(),
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
		operations,
		portOffsets,
		width: EditorOriginFlowNodeWidth,
	};
};
