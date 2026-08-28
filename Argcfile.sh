#!/usr/bin/env bash

set -euo pipefail

if [[ "${ARKINI_MISE_ACTIVE:-}" != "1" ]]; then
	if ! command -v mise >/dev/null 2>&1; then
		echo "Arkini repository commands require mise: https://mise.jdx.dev" >&2
		exit 127
	fi
	export ARKINI_MISE_ACTIVE=1
	exec mise exec -- bash "$0" "$@"
fi

# @describe Arkini repository commands

desktop_version() {
	node -p "require('./package.json').version"
}

clean_desktop() {
	rm -rf .out/desktop
}

build_desktop() {
	electron-vite build
}

install_game_arkpack() {
	local source target verdict
	target=game/arkini/build/arkini.arkpack
	if [[ -z "${ARKINI_PREBUILT_ARKPACK:-}" ]]; then
		node .out/desktop/build/main/cli/arkini.js game pack ./game/arkini
	else
		source=$(cd -- "$(dirname -- "$ARKINI_PREBUILT_ARKPACK")" && pwd)/$(basename -- "$ARKINI_PREBUILT_ARKPACK")
		if [[ ! -f "$source" ]]; then
			echo "Prebuilt Arkpack does not exist: $source" >&2
			exit 1
		fi
		rm -rf game/arkini/build
		mkdir -p game/arkini/build
		cp "$source" "$target"
		cmp "$source" "$target"
	fi
	verdict=${ARKINI_EXPECTED_PROVENANCE:-community}
	node .out/desktop/build/main/cli/arkini.js arkpack verify "$target" |
		grep -Fx "{\"type\":\"$verdict\"}"
}

format_check() {
	biome format .
}

dependency_check() {
	depcruise \
		src/engine src/editor src/bridge src/ui src/page src/@routes \
		src/main.tsx src/createArkiniRouterFx.tsx src/_route.ts \
		electron electron.vite.config.ts test \
		--output-type err-long
}

copy_paste_check() {
	jscpd --config jscpd.json
}

package_macos_artifacts() {
	local packaged_cli version
	version=$(desktop_version)
	packaged_cli=.out/desktop/release/mac-arm64/Arkini.app/Contents/MacOS/arkini-cli
	electron-builder \
		--config electron-builder.yml \
		--mac \
		--arm64 \
		--publish never
	cp game/arkini/build/arkini.arkpack .out/desktop/release/arkini.arkpack
	"$packaged_cli" --version | grep -F "$version"
	cmp game/arkini/build/arkini.arkpack \
		.out/desktop/release/mac-arm64/Arkini.app/Contents/Resources/game/arkini.arkpack
	"$packaged_cli" arkpack verify game/arkini/build/arkini.arkpack |
		grep -Fx "{\"type\":\"${ARKINI_EXPECTED_PROVENANCE:-community}\"}"
}

package_windows_artifacts() {
	electron-builder \
		--config electron-builder.yml \
		--win \
		--x64 \
		--publish never
	cmp game/arkini/build/arkini.arkpack \
		.out/desktop/release/win-unpacked/resources/game/arkini.arkpack
}

package_linux_artifacts() {
	local architecture unpacked
	architecture=$1
	unpacked=linux-unpacked
	if [[ "$architecture" == "arm64" ]]; then
		unpacked=linux-arm64-unpacked
	fi
	electron-builder \
		--config electron-builder.yml \
		--linux AppImage \
		"--$architecture" \
		--publish never
	cmp game/arkini/build/arkini.arkpack \
		".out/desktop/release/$unpacked/resources/game/arkini.arkpack"
}

# @cmd Install exact JavaScript dependencies from the lockfile
install() {
	npm ci
}

# @cmd Refresh the offline Sigstore trusted-root snapshot through TUF
signing:update-trusted-root() {
	tsx scripts/updateArkpackTrustedRoot.ts
}

# @cmd Build and verify the offline Linux x64 npm cache for LLM environments
llm:cache() {
	(
		local root_dir cache_dir work_dir registry lock_hash archive archive_hash
		local -a npm_args
		root_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
		cache_dir="$root_dir/.npm-cache"
		work_dir="$cache_dir/.work"
		registry="https://registry.npmjs.org/"
		npm_args=(
			ci
			--omit=peer
			--registry="$registry"
			--cache="$cache_dir"
			--os=linux
			--cpu=x64
			--libc=glibc
			--ignore-scripts
			--no-audit
			--no-fund
		)

		for command in npm tar shasum; do
			if ! command -v "$command" >/dev/null 2>&1; then
				echo "Missing required command: $command" >&2
				exit 1
			fi
		done
		if [[ ! -f "$root_dir/package.json" || ! -f "$root_dir/package-lock.json" ]]; then
			echo "package.json and package-lock.json must exist in $root_dir." >&2
			exit 1
		fi

		trap 'rm -rf "$work_dir"' EXIT
		mkdir -p "$cache_dir"
		rm -rf "$work_dir"
		mkdir -p "$work_dir"
		cp "$root_dir/package.json" "$root_dir/package-lock.json" "$work_dir/"

		echo "Building Linux x64 npm cache in $cache_dir ..."
		(cd "$work_dir" && npm "${npm_args[@]}")

		echo "Verifying cache with a network-free install ..."
		rm -rf "$work_dir/node_modules"
		(cd "$work_dir" && npm "${npm_args[@]}" --offline)

		rm -rf "$work_dir"
		npm cache verify --cache="$cache_dir" >/dev/null
		rm -rf "$cache_dir/_logs"
		rm -f "$cache_dir/_update-notifier-last-checked"

		lock_hash=$(shasum -a 256 "$root_dir/package-lock.json" | awk '{print substr($1, 1, 12)}')
		archive="$root_dir/arkini-npm-cache-linux-x64-$lock_hash.tgz"
		rm -f "$archive"
		tar -C "$root_dir" -czf "$archive" .npm-cache
		archive_hash=$(shasum -a 256 "$archive" | awk '{print $1}')

		echo
		echo "Cache archive ready:"
		echo "  $archive"
		echo "  SHA-256: $archive_hash"
	)
}

# @cmd Regenerate the portable game-project JSON Schema
game:schema() {
	tsx src/engine/cli/arkini.ts game schema --output game/arkini/schema.json
}

# @cmd Set the repository package version without creating a Git tag
# @arg version! Version to write
version() {
	local version_backup
	version_backup=$(mktemp -d)
	cp -p package.json "$version_backup/package.json"
	cp -p package-lock.json "$version_backup/package-lock.json"
	cp -p game/arkini/project.json "$version_backup/project.json"
	if ! npm version --allow-same-version --no-git-tag-version "$argc_version"; then
		cp -p "$version_backup/package.json" package.json
		cp -p "$version_backup/package-lock.json" package-lock.json
		cp -p "$version_backup/project.json" game/arkini/project.json
		rm -f game/arkini/project.json.version.pending
		rm -R "$version_backup"
		return 1
	fi
	if ! node --input-type=module -e '
		import { readFile, rename, writeFile } from "node:fs/promises";
		const packageManifest = JSON.parse(await readFile("package.json", "utf8"));
		const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));
		if (
			packageLock.version !== packageManifest.version ||
			packageLock.packages?.[""]?.version !== packageManifest.version
		) throw new Error("package-lock.json does not match package.json after versioning.");
		const path = "game/arkini/project.json";
		const pending = `${path}.version.pending`;
		const project = JSON.parse(await readFile(path, "utf8"));
		project.arkini = packageManifest.version;
		await writeFile(pending, `${JSON.stringify(project, undefined, "\t")}\n`);
		await rename(pending, path);
	'; then
		cp -p "$version_backup/package.json" package.json
		cp -p "$version_backup/package-lock.json" package-lock.json
		cp -p "$version_backup/project.json" game/arkini/project.json
		rm -f game/arkini/project.json.version.pending
		rm -R "$version_backup"
		return 1
	fi
	rm -R "$version_backup"
}

# @cmd Start the Electron application in development mode
dev() {
	electron-vite dev
}

# @cmd Start development with the loopback Chromium control endpoint
dev-control() {
	ARKINI_DEV_CONTROL=1 electron-vite dev
}

# @cmd Inspect the editor MCP endpoint
mcp-inspect() {
	mcp-inspector \
		--web \
		--server-url http://127.0.0.1:32310/editor/mcp \
		--transport http
}

# @cmd Build Electron and verify the bundled game Arkpack
build() {
	build_desktop
	install_game_arkpack
}

# @cmd Build and open the unpacked macOS arm64 application
preview-macos() {
	clean_desktop
	build
	electron-builder \
		--config electron-builder.yml \
		--mac \
		--arm64 \
		--dir \
		--publish never
	open .out/desktop/release/mac-arm64/Arkini.app
}

# @cmd Build macOS arm64 release artifacts
package-macos() {
	clean_desktop
	build_desktop
	install_game_arkpack
	package_macos_artifacts
}

# @cmd Build Windows x64 release artifacts
package-windows() {
	clean_desktop
	build_desktop
	install_game_arkpack
	package_windows_artifacts
}

# @cmd Build Linux x64 AppImage release artifacts
package-linux() {
	clean_desktop
	build_desktop
	install_game_arkpack
	package_linux_artifacts x64
}

# @cmd Build Linux arm64 AppImage release artifacts
package-linux-arm64() {
	clean_desktop
	build_desktop
	install_game_arkpack
	package_linux_artifacts arm64
}

# @cmd Format the repository
format() {
	biome format --write .
}

# @cmd Typecheck source, tests, and Electron
typecheck() {
	tsc -p tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
	tsc -p tsconfig.test.json --noEmit --noUnusedLocals --noUnusedParameters
	tsc -p tsconfig.electron.json --noEmit --noUnusedLocals --noUnusedParameters
}

run_tests() {
	vitest run --no-color "$@"
}

# @cmd Run the permanent test suite, optionally filtered by paths
# @arg filters~ Vitest file or directory filters
test() {
	if [[ -n "${argc_filters+x}" ]]; then
		run_tests "${argc_filters[@]}"
		return
	fi
	run_tests
}

# @cmd Build and test operating-system boundaries
platform-check() {
	build
	run_tests \
		test/engine/filesystem \
		test/electron \
		test/pack \
		test/schema/fx \
		test/source
}

# @cmd Run the complete repository gate
check() {
	format_check
	typecheck
	build
	dependency_check
	copy_paste_check
	test
}

eval "$(argc --argc-eval "$0" "$@")"
