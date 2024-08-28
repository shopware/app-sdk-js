SHELL := /bin/bash
PACKAGES := app-server-sdk app-server-sdk-cloudflare app-server-sdk-deno app-server-sdk-hono

init:
	pnpm install

	for package in $(PACKAGES); do \
		(cd packages/$$package && bunx tshy); \
	done

	# fix the package.json formatting
	bunx @biomejs/biome format . --write
lint:
	bunx @biomejs/biome ci .

lint-fix:
	bunx @biomejs/biome lint . --write
	bunx @biomejs/biome format . --write
	bunx @biomejs/biome check . --write
typecheck:
	bunx tsc --noEmit
bump-version:
	for package in $(PACKAGES); do \
		(cd packages/$$package && jq '.version = "$(version)"' package.json > tmp.json && mv tmp.json package.json); \
	done

	bunx @biomejs/biome format . --write