import { Effect } from "effect";

import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";
import type { DiagnosticPathSchema } from "~/engine/validation/schema/DiagnosticPathSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace parseGameSourceFileFx {
	export interface Props {
		readonly path: string;
		readonly source: string;
	}

	export interface Result {
		readonly source?: GameSourceFileSchema.Type;
		readonly diagnostics: GameDiagnosticsSchema.Type;
	}
}

/** Parses one in-memory JSON authoring fragment with source-aware diagnostics. */
export const parseGameSourceFileFx = Effect.fn("parseGameSourceFileFx")(
	({ path, source }: parseGameSourceFileFx.Props) =>
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

			const parsed = GameSourceSchema.safeParse(json);
			if (!parsed.success) {
				return {
					diagnostics: parsed.error.issues.map((issue) => ({
						code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: issue.path.map((segment) =>
							typeof segment === "string" || typeof segment === "number"
								? segment
								: String(segment),
						) satisfies DiagnosticPathSchema.Type,
						source: path,
						message: issue.message,
						issueCode: issue.code,
					})),
				};
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
