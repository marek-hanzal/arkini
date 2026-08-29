import { TrustedRoot } from "@sigstore/protobuf-specs";
import { getTrustedRoot } from "@sigstore/tuf";
import { writeFile } from "node:fs/promises";

const output = new URL("../src/arkpack/artifact/trusted-root.json", import.meta.url);
const trustedRoot = await getTrustedRoot({
	force: true,
});
await writeFile(output, `${JSON.stringify(TrustedRoot.toJSON(trustedRoot), null, "\t")}\n`);
console.log(`Updated ${output.pathname}.`);
