#!/usr/bin/env bash
# Builds two zips:
#   dist/drydock-plugin.zip       the plugin folder's contents (one .claude-plugin/plugin.json at the root): for claude.ai's Add > Upload plugin
#   dist/drydock-marketplace.zip  a local marketplace folder: unzip, then /plugin marketplace add <folder> in Claude Code
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist/zip-stage && mkdir -p dist/zip-stage
( cd plugin && rm -f ../dist/drydock-plugin.zip && zip -qr ../dist/drydock-plugin.zip . -x '*.DS_Store' )
mkdir -p dist/zip-stage/drydock/.claude-plugin
cp -R plugin dist/zip-stage/drydock/plugin
cp .claude-plugin/marketplace.json dist/zip-stage/drydock/.claude-plugin/marketplace.json
cp README.md LICENSE dist/zip-stage/drydock/
( cd dist/zip-stage && rm -f ../drydock-marketplace.zip && zip -qr ../drydock-marketplace.zip drydock -x '*.DS_Store' )
rm -rf dist/zip-stage
ls -la dist/*.zip
unzip -l dist/drydock-plugin.zip | grep -c "plugin.json" | sed 's/^/plugin.json entries in drydock-plugin.zip: /'
