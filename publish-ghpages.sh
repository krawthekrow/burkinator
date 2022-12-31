#!/bin/bash
set -eu

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]
then
	>&2 echo "not on main branch"
	exit 1
fi

if [[ -n "$(git status -s)" ]]
then
	>&2 echo "not clean"
	exit 1
fi

git branch -D ghpages
git switch -c ghpages
npm run build-ghpages
git add -A
git commit -m "build for ghpages"
git push -f origin ghpages
git switch main
