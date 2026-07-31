import { createHash } from "node:crypto";
import { Effect } from "effect";

import type { EditorProjectFile } from "../../contract/editor/EditorProjectFile";

export namespace readEditorProjectRevisionFx {
	export interface Props {
		readonly projectId: string;
		readonly files: ReadonlyArray<EditorProjectFile>;
	}
}

const updateLength = (hash: ReturnType<typeof createHash>, value: number) => {
	const bytes = Buffer.allocUnsafe(8);
	bytes.writeBigUInt64BE(BigInt(value));
	hash.update(bytes);
};

/** Computes a stable revision over exact project paths and bytes. */
export const readEditorProjectRevisionFx = Effect.fn(
	"readEditorProjectRevisionFx",
)(({ projectId, files }: readEditorProjectRevisionFx.Props) =>
	Effect.sync(() => {
		const hash = createHash("sha256");
		const projectIdBytes = Buffer.from(projectId);
		updateLength(hash, projectIdBytes.byteLength);
		hash.update(projectIdBytes);
		for (const file of [
			...files,
		].sort((left, right) => left.path.localeCompare(right.path))) {
			const pathBytes = Buffer.from(file.path);
			updateLength(hash, pathBytes.byteLength);
			hash.update(pathBytes);
			updateLength(hash, file.bytes.byteLength);
			hash.update(file.bytes);
		}
		return hash.digest("hex");
	}),
);
