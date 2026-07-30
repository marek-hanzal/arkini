import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createEditorJsonSourceFileFx } from "~/engine/source/editor/fx/createEditorJsonSourceFileFx";

const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

const readStableIdHash = (value: string) => {
	let hash = 0xcbf29ce484222325n;
	for (const byte of new TextEncoder().encode(value)) {
		hash ^= BigInt(byte);
		hash = BigInt.asUintN(64, hash * 0x100000001b3n);
	}
	return hash.toString(16).padStart(16, "0");
};

const createReadableStem = (id: string, type: GameConfigSchema.Type["items"][string]["type"]) => {
	let readable = id.startsWith("item:") ? id.slice("item:".length) : id;
	if (readable.startsWith(`${type}:`)) readable = readable.slice(type.length + 1);
	if (type === "blueprint" && readable.startsWith("blueprint-")) {
		readable = readable.slice("blueprint-".length);
	}
	if (type === "temporary" && readable.startsWith("effect:")) {
		readable = readable.slice("effect:".length);
	}
	const slug = readable
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[.-]+|[.-]+$/g, "")
		.slice(0, 96)
		.replace(/[.-]+$/g, "");
	if (slug === "") return "item";
	const portableSlug = /^[A-Za-z0-9]/.test(slug) ? slug : `item-${slug}`;
	return windowsDeviceNamePattern.test(portableSlug) ? `item-${portableSlug}` : portableSlug;
};

/** Splits completed items into stable one-item JSON fragments owned by item type. */
export const createItemEditorSourceFilesFx = Effect.fn("createItemEditorSourceFilesFx")(
	(items: GameConfigSchema.Type["items"]) => {
		const entries = Object.entries(items)
			.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
			.map(([id, item]) => ({
				id,
				item,
				stem: createReadableStem(id, item.type),
			}));
		const pathCounts = new Map<string, number>();
		for (const entry of entries) {
			const path = `${entry.item.type}/${entry.stem}.json`.toLowerCase();
			pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
		}
		return Effect.forEach(entries, ({ id, item, stem }) => {
			const candidatePath = `${item.type}/${stem}.json`;
			const filename =
				pathCounts.get(candidatePath.toLowerCase()) === 1
					? `${stem}.json`
					: `${stem.slice(0, 72)}-${readStableIdHash(id)}.json`;
			return createEditorJsonSourceFileFx({
				path: `${item.type}/${filename}`,
				value: {
					items: {
						[id]: item,
					},
				},
			});
		});
	},
);
