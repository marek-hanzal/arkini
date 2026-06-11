export interface AssetDefinition {
  id: string;
  kind: "item" | "ui";
  label: string;
  src: string;
}

const svg = (name: string) => new URL(`./svg/${name}.svg`, import.meta.url).href;

export const assetDefinitions = [
  { id: "asset:item-seed", kind: "item", label: "Seed", src: svg("item-seed") },
  { id: "asset:item-sprout", kind: "item", label: "Sprout", src: svg("item-sprout") },
  { id: "asset:item-leaf", kind: "item", label: "Leaf", src: svg("item-leaf") },
  { id: "asset:item-twig", kind: "item", label: "Twig", src: svg("item-twig") },
  { id: "asset:item-branch", kind: "item", label: "Branch", src: svg("item-branch") },
  { id: "asset:item-log", kind: "item", label: "Log", src: svg("item-log") },
  { id: "asset:item-pebble", kind: "item", label: "Pebble", src: svg("item-pebble") },
  { id: "asset:item-stone", kind: "item", label: "Stone", src: svg("item-stone") },
  { id: "asset:item-crystal", kind: "item", label: "Crystal", src: svg("item-crystal") },
  { id: "asset:ui-slot", kind: "ui", label: "Board Slot", src: svg("ui-slot") },
] as const satisfies readonly AssetDefinition[];

export type AssetId = (typeof assetDefinitions)[number]["id"];
