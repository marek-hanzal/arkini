import { Effect } from "effect";
import { z } from "zod";

const schemaMaps = new Set([
	"$defs",
	"definitions",
	"properties",
	"patternProperties",
	"dependentSchemas",
]);
const schemaChildren = new Set([
	"items",
	"prefixItems",
	"additionalItems",
	"contains",
	"additionalProperties",
	"unevaluatedProperties",
	"unevaluatedItems",
	"propertyNames",
	"allOf",
	"anyOf",
	"oneOf",
	"not",
	"if",
	"then",
	"else",
	"contentSchema",
]);
const isObjectFn = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Depth counts reference edges only. The ancestor path is branch-local, so siblings expand independently. */
const resolveSchemaFn = (
	value: unknown,
	schemas: Readonly<Record<string, unknown>>,
	depth: number,
	path: ReadonlySet<string>,
	resourceId: string,
	inline: boolean,
): unknown => {
	if (Array.isArray(value))
		return value.map((child) =>
			resolveSchemaFn(child, schemas, depth, path, resourceId, inline),
		);
	if (!isObjectFn(value)) return value;
	const ref = value.$ref;
	const expand =
		typeof ref === "string" && depth > 0 && !path.has(ref) && Object.hasOwn(schemas, ref);
	const siblings = Object.fromEntries(
		Object.entries(value).flatMap(([key, child]) => {
			if (expand && key === "$ref") return [];
			// Embedded copies must not register duplicate resource IDs. Local refs retain their original resource scope.
			if (inline && (key === "$id" || key === "$schema")) return [];
			if (inline && key === "$ref" && typeof child === "string" && child.startsWith("#"))
				return [
					[
						key,
						`${resourceId}${child}`,
					],
				];
			if (schemaMaps.has(key) && isObjectFn(child))
				return [
					[
						key,
						Object.fromEntries(
							Object.entries(child).map(([name, schema]) => [
								name,
								resolveSchemaFn(schema, schemas, depth, path, resourceId, inline),
							]),
						),
					],
				];
			if (schemaChildren.has(key))
				return [
					[
						key,
						resolveSchemaFn(child, schemas, depth, path, resourceId, inline),
					],
				];
			// Defaults, examples, enums and extension values are data, even when they contain a literal $ref.
			return [
				[
					key,
					child,
				],
			];
		}),
	);
	if (!expand) return siblings;
	const resolved = resolveSchemaFn(
		schemas[ref],
		schemas,
		depth - 1,
		new Set([
			...path,
			ref,
		]),
		ref,
		true,
	);
	if (Object.keys(siblings).length === 0) return resolved;
	// $ref siblings are conjunctive; object spread would overwrite constraints. Keep unevaluated* at the outer scope.
	return {
		...siblings,
		allOf: [
			...(Array.isArray(siblings.allOf) ? siblings.allOf : []),
			resolved,
		],
	};
};

/** Reads one registry schema, optionally expanding registered references without changing their constraints. */
export const readSchemaDetailTextFx = Effect.fn("readSchemaDetailTextFx")(
	(id: string, resolveDepth = 0) =>
		Effect.try({
			try: () => {
				const schemas = z.toJSONSchema(z.globalRegistry, {
					io: "input",
					reused: "inline",
					target: "draft-2020-12",
					unrepresentable: "any",
				}).schemas;
				if (!Object.hasOwn(schemas, id))
					throw new Error(`Schema ${JSON.stringify(id)} is not registered.`);
				return JSON.stringify(
					resolveDepth === 0
						? schemas[id]
						: resolveSchemaFn(
								schemas[id],
								schemas,
								resolveDepth,
								new Set([
									id,
								]),
								id,
								false,
							),
					null,
					2,
				);
			},
			catch: (cause) => cause,
		}),
);
