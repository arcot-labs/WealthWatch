#!/bin/bash

set -eo pipefail

PACKAGE_NAME="@arcot-labs/wealthwatch-shared"

echo "Checking for changes in shared project files..."
CHANGED_FILES=$(git diff --cached --name-only)

if echo "$CHANGED_FILES" | grep -qE '^shared/(package.json|tsconfig.json|tsconfig.build.json|src/)'; then
    echo "Changes found in shared project files"
    echo "Checking for version bump..."

    if OLD=$(npm view "$PACKAGE_NAME" version); then
        echo "Latest published version is $OLD"
    else
        echo "Package not yet published. Skipping version comparison"
        exit 0
    fi

    NEW=$(git show :shared/package.json | jq -r .version)

    if [ "$OLD" = "$NEW" ]; then
        echo "Shared project version not updated"
        echo "Run 'npm version patch/minor/major' in shared/ before committing"
        exit 1
    else
        echo "Shared project version updated from $OLD to $NEW"
    fi
else
    echo "No changes found in shared project files"
fi
