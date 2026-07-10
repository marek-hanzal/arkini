import { sep } from "node:path";
import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "./test/readArkiniGameSources";

describe("Arkini source layout", () => {
	it("organizes every item fragment under its era or common scope and item type", () => {
		for (const source of readArkiniGameSources()) {
			const items = Object.values(
				(
					source.value as {
						readonly items?: Readonly<
							Record<
								string,
								{
									readonly type: string;
								}
							>
						>;
					}
				).items ?? {},
			);
			if (items.length === 0) continue;

			expect(items, source.path).toHaveLength(1);
			const [item] = items;
			const typeDirectory = item.type.replaceAll(":", "-");
			const itemPath = source.path.split(`${sep}game${sep}arkini${sep}`)[1];
			const pathParts = itemPath.split(sep);

			expect(pathParts[0], source.path).toMatch(/^(common|era-[IVX]+)$/);
			expect(pathParts[1], source.path).toBe(typeDirectory);
		}
	});
});
