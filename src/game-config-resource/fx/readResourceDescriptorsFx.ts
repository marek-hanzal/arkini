import { Path } from "effect";
import { Effect } from "effect";

import { collectSourceFilesFx } from "~/game-config-source/fx/collectSourceFilesFx";
import type { ResourceDescriptorSchema } from "../schema/ResourceDescriptorSchema";

export namespace readResourceDescriptorsFx {
	export interface Props {
		input: string;
	}
}

/** Reads exact typed resource identities from their canonical source directories. */
export const readResourceDescriptorsFx = Effect.fn("readResourceDescriptorsFx")(function* ({
	input,
}: readResourceDescriptorsFx.Props) {
	const path = yield* Path.Path;
	const files = yield* collectSourceFilesFx({
		input,
	});

	return files.resources.map((resource) => {
		const resourcePath = resource.path;
		return {
			id: path.basename(resourcePath, path.extname(resourcePath)),
			type: resource.type,
			path: resourcePath,
		} satisfies ResourceDescriptorSchema.Type;
	});
});
