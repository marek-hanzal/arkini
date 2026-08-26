import { Effect } from "effect";

import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import { GameProjectFileSchema } from "~/engine/source/schema/GameProjectFileSchema";
import { GameProjectItemFileSchema } from "~/engine/source/schema/GameProjectItemFileSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { gameSourceSchemaDiagnostics } from "./readRequiredGameProjectJsonFx";

export namespace parseGameSourceFileFx {
	export interface Props {
		readonly path: string;
		readonly relative: string;
		readonly source: string;
	}

	export interface Result {
		readonly source?: GameSourceFileSchema.Type;
		readonly projectIdentity?: {
			readonly packageId: string;
			readonly version: ArkpackVersionSchema.Type;
		};
		readonly diagnostics: GameDiagnosticsSchema.Type;
	}
}

/** Parses one in-memory JSON authoring fragment with source-aware diagnostics. */
export const parseGameSourceFileFx = Effect.fn("parseGameSourceFileFx")(
	({ path, relative, source }: parseGameSourceFileFx.Props) =>
		Effect.sync((): parseGameSourceFileFx.Result => {
			let json: unknown;
			try {
				json = JSON.parse(source);
			} catch (error) {
				return {
					diagnostics: [
						{
							code: DiagnosticCodeEnumSchema.enum.SourceJsonInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [],
							source: path,
							message:
								error instanceof Error ? error.message : "Invalid JSON syntax.",
						},
					],
				};
			}

			const gameProjectRoot = relative === "game.json";
			const parsed = gameProjectRoot
				? GameProjectFileSchema.safeParse(json)
				: GameProjectItemFileSchema.safeParse(json);
			if (!parsed.success) {
				return {
					diagnostics: gameSourceSchemaDiagnostics(path, parsed.error),
				};
			}

			if (gameProjectRoot) {
				const { arkpack, ...value } = parsed.data as GameProjectFileSchema.Type;
				return {
					source: {
						path,
						value,
					},
					projectIdentity: {
						packageId: value.meta.id,
						version: arkpack,
					},
					diagnostics: [],
				};
			}
			if (!gameProjectRoot) {
				const value = parsed.data as GameProjectItemFileSchema.Type;
				const entry = Object.entries(value.items)[0];
				if (entry === undefined) throw new Error("Parsed item file contains no item.");
				const [itemId, item] = entry;
				const segments = relative.split("/");
				const expectedFilename = `${encodeURIComponent(item.uid).replaceAll(".", "%2E")}.json`;
				const formatError =
					segments.length !== 3 || segments[0] !== "items"
						? "Expected items/<type>/<encoded uid>.json."
						: item.id !== itemId
							? `Item record key ${JSON.stringify(itemId)} differs from item ID ${JSON.stringify(item.id)}.`
							: item.type !== segments[1]
								? `Item type ${JSON.stringify(item.type)} differs from directory ${JSON.stringify(segments[1])}.`
								: segments[2] !== expectedFilename
									? `Item UID ${JSON.stringify(item.uid)} requires filename ${JSON.stringify(expectedFilename)}.`
									: undefined;
				if (formatError !== undefined) {
					return {
						diagnostics: [
							{
								code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
								severity: DiagnosticSeverityEnumSchema.enum.Error,
								path: [
									"items",
									itemId,
								],
								source: path,
								message: formatError,
								issueCode: "game-project-path",
							},
						],
					};
				}
			}

			return {
				source: {
					path,
					value: parsed.data,
				},
				diagnostics: [],
			};
		}),
);
