import { createHash } from "node:crypto";

import type { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import type { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";

const encoder = new TextEncoder();

export const hashFilesystemEditorVersionBytes = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

export const hashFilesystemEditorVersionJson = (value: unknown) =>
	hashFilesystemEditorVersionBytes(encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`));

const sortedRecord = (
	entries: ReadonlyArray<
		readonly [
			string,
			string,
		]
	>,
) =>
	Object.fromEntries(
		[
			...entries,
		].sort(([left], [right]) => left.localeCompare(right)),
	);

/** Hashes authored content while excluding checkout-specific scenario provenance. */
export const createFilesystemEditorVersionFingerprint = (
	manifest: EditorVersionManifestSchema.Type,
	scenarios: ReadonlyArray<EditorBoardScenarioFileSchema.Type>,
) =>
	hashFilesystemEditorVersionBytes(
		encoder.encode(
			JSON.stringify({
				...manifest,
				scenarios: sortedRecord(
					scenarios.map(
						({ revision: _revision, ...scenario }) =>
							[
								scenario.name,
								hashFilesystemEditorVersionJson(scenario),
							] as const,
					),
				),
			}),
		),
	);
