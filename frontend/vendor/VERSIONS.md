# Vendored library versions

These libraries are checked into git as static files rather than installed via npm — there is no build step for the frontend, so they can't be resolved from `node_modules` at request time. This file is the single source of truth for what's actually deployed; re-confirm by re-grepping the file itself before assuming a version, since these files carry no `package.json` of their own.

## marked.min.js
- Version: 18.0.10
- License: MIT
- Source: https://github.com/markedjs/marked
- Confirmed via: header comment at the top of the file (`marked v18.0.10 - a markdown parser`)

## purify.min.js
- Version: DOMPurify 3.4.14
- License: Apache-2.0 / Mozilla Public License 2.0 (dual)
- Source: https://github.com/cure53/DOMPurify
- Confirmed via: header comment at the top of the file, which also links the exact tagged release (`github.com/cure53/DOMPurify/blob/3.4.14/LICENSE`)

## katex/ (katex.min.js, katex.min.css, auto-render.min.js, fonts/*.woff2)
- Version: 0.18.5
- License: MIT (see `katex/LICENSE`)
- Source: https://github.com/KaTeX/KaTeX
- Confirmed via: `grep -oE 'version:"[0-9.]+"' katex.min.js` — the file has no header comment or manifest recording its version, unlike the two libraries above. Re-run this grep after any manual update to confirm the new version, since nothing else in this directory will tell you.

## Updating any of these

There's no automated update path — download the new minified build + fonts from the library's own release, drop the files in place here, and update this file with the new version before committing.
