import { Path } from "effect";
import { Effect } from "effect";

import { collectSourceFilesFx } from "~/game-config-source/fx/collectSourceFilesFx";
import type { ResourceDescriptorSchema } from "../schema/ResourceDescriptorSchema";

export namespace readResourceDescriptorsFx {
	export interface Props {
		input: string;
	}
}

/** Reads exact PNG resource identities from filename basenames without mapping magic. */
export const readResourceDescriptorsFx = Effect.fn("readResourceDescriptorsFx")(function* ({
	input,
}: readResourceDescriptorsFx.Props) {
	const path = yield* Path.Path;
	const files = yield* collectSourceFilesFx({
		input,
	});

	return files.png.map((resourcePath) => {
		const relative = path.relative(files.root, resourcePath).replaceAll("\\", "/");
		return {
			id: path.basename(resourcePath, path.extname(resourcePath)),
			kind: relative.startsWith("assets/") ? "asset" : "resource",
			path: resourcePath,
			mime: "image/png",
		} satisfies ResourceDescriptorSchema.Type;
	});
});
