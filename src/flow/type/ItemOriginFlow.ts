import type {
	ItemOriginRequirementOccurrence,
	ItemOriginUnsupportedRequirementOccurrence,
} from "~/flow/type/ItemOriginSource";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

export type ItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";

export const ItemOriginItemInputPortId = "item:self:input";
export const ItemOriginItemOutputPortId = "item:self:output";

export type ItemOriginOperationRequirementContext =
	| {
			readonly clause: "all-of" | "any-of";
			readonly clauseIndex?: number;
			readonly outputRouteId: string;
			readonly requirement: ItemOriginRequirementOccurrence;
	  }
	| {
			readonly clause: "unsupported";
			readonly outputRouteId: string;
			readonly requirement: ItemOriginUnsupportedRequirementOccurrence;
	  };

interface ItemOriginOperationPort {
	readonly id: string;
	readonly itemId: string;
	readonly label: string;
	readonly requirementContexts?: ReadonlyArray<ItemOriginOperationRequirementContext>;
}

export interface ItemOriginOperation {
	readonly id: string;
	readonly inputs: ReadonlyArray<ItemOriginOperationPort>;
	readonly kind: ItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<ItemOriginOperationPort>;
}

export interface ItemOriginItemNode {
	readonly acquisitionSourceId?: string;
	readonly id: string;
	readonly itemId: string;
	readonly operations: ReadonlyArray<ItemOriginOperation>;
	readonly resourceIds: ItemSchema.Type["asset"]["default"];
	readonly starterScopes: ReadonlyArray<"Board" | "Inventory" | "Toolbar">;
	readonly title: string;
	readonly type: ItemSchema.Type["type"] | "missing";
}

export interface ItemOriginEdge {
	readonly id: string;
	readonly operationId: string;
	readonly role: "input" | "output";
	readonly requirementContexts?: ReadonlyArray<ItemOriginOperationRequirementContext>;
	readonly source: string;
	readonly sourcePortId?: string;
	readonly target: string;
	readonly targetPortId?: string;
}

export interface ItemOriginFlow {
	readonly edges: ReadonlyArray<ItemOriginEdge>;
	readonly nodes: ReadonlyArray<ItemOriginItemNode>;
}

export interface ItemOriginFlowProgress {
	readonly label: string;
	readonly percent: number;
}
