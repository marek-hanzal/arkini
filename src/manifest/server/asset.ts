import type { AssetId } from "./ids";

export interface AssetDefinition {
  id: AssetId;
  kind: "item" | "ui";
  label: string;
  src: string;
  sort: number;
}
