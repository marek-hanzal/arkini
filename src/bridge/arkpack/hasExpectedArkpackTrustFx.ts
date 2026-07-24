import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

export namespace hasExpectedArkpackTrustFx {
	export interface Props {
		readonly actual: ArkpackTrustSchema.Type;
		readonly expected: ArkpackTrustSchema.Type;
	}
}

/** Compares exact trust metadata against generated bundled-package metadata. */
export const hasExpectedArkpackTrustFx = Effect.fn("hasExpectedArkpackTrustFx")(
	({ actual, expected }: hasExpectedArkpackTrustFx.Props) =>
		Effect.succeed(
			match([
				actual,
				expected,
			] as const)
				.with(
					[
						{
							type: "official",
						},
						{
							type: "official",
						},
					],
					([actualTrust, expectedTrust]) => actualTrust.keyId === expectedTrust.keyId,
				)
				.with(
					[
						{
							type: "external",
						},
						{
							type: "external",
						},
					],
					([actualTrust, expectedTrust]) => actualTrust.reason === expectedTrust.reason,
				)
				.with(
					[
						{
							type: "invalid",
						},
						{
							type: "invalid",
						},
					],
					([actualTrust, expectedTrust]) =>
						actualTrust.reason === expectedTrust.reason &&
						actualTrust.keyId === expectedTrust.keyId,
				)
				.with(
					[
						{
							type: "official",
						},
						{
							type: P.union("external", "invalid"),
						},
					],
					() => false,
				)
				.with(
					[
						{
							type: "external",
						},
						{
							type: P.union("official", "invalid"),
						},
					],
					() => false,
				)
				.with(
					[
						{
							type: "invalid",
						},
						{
							type: P.union("official", "external"),
						},
					],
					() => false,
				)
				.exhaustive(),
		),
);
