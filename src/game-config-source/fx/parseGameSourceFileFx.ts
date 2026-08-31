import { Effect } from "effect";

import { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import { GameFileSchema } from "~/game-config-source/schema/GameFileSchema";
import { ItemFileSchema } from "~/game-config-source/schema/ItemFileSchema";
import type { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { gameSourceSchemaDiagnosticsFn } from "~/game-config-source/fn/gameSourceSchemaDiagnosticsFn";

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
				? GameFileSchema.safeParse(json)
				: ItemFileSchema.safeParse(json);
			if (!parsed.success) {
				return {
					diagnostics: gameSourceSchemaDiagnosticsFn(path, parsed.error),
				};
			}

			if (gameProjectRoot) {
				const { version, ...value } = parsed.data as GameFileSchema.Type;
				return {
					source: {
						path,
						value,
					},
					projectIdentity: {
						packageId: value.meta.id,
						version,
					},
					diagnostics: [],
				};
			}
			if (!gameProjectRoot) {
				const value = parsed.data as ItemFileSchema.Type;
				const item = value.item;
				const segments = relative.split("/");
				const expectedFilename = `${encodeGameProjectFileStemFn(item.uid)}.json`;
				const formatError =
					segments.length !== 3 || segments[0] !== "items"
						? "Expected items/<type>/<encoded uid>.json."
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
									"item",
								],
								source: path,
								message: formatError,
								issueCode: "game-project-path",
							},
						],
					};
				}
			}

			const itemFile = parsed.data as ItemFileSchema.Type;
			return {
				source: {
					path,
					value: {
						$schema: itemFile.$schema,
						items: {
							[itemFile.item.id]: itemFile.item,
						},
					},
				},
				diagnostics: [],
			};
		}),
);
