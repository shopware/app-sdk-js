SHELL := /bin/bash

init:
	pnpm install

	pushd packages/app-server-sdk && bunx tshy && popd

lint:
	bunx @biomejs/biome ci .
lint-fix:
	bunx @biomejs/biome lint . --write && bunx @biomejs/biome format . --write && bunx @biomejs/biome check . --write
typecheck:
	bunx tsc --noEmit
