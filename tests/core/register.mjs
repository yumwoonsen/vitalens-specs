// Resolve hook for the Node core tests (plan Task 5).
//
// Lens Studio's TypeScript imports leave the ".ts" extension off
// (`import {reduce} from "./EncounterReducer"`). Node's type stripping needs a
// real file path, so this hook adds ".ts" to extensionless relative imports made
// from a .ts file when that file exists. Nothing else is changed, so the tests
// load exactly the files Lens Studio compiles.
//
// Run: node --import ./tests/core/register.mjs --test "tests/core/*.test.ts"
import {registerHooks} from "node:module"
import {existsSync} from "node:fs"
import {fileURLToPath} from "node:url"

const HAS_EXTENSION = /\.[cm]?[jt]s$/

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../")
    const fromTs = context.parentURL !== undefined && context.parentURL.endsWith(".ts")
    if (relative && fromTs && !HAS_EXTENSION.test(specifier)) {
      const url = new URL(specifier + ".ts", context.parentURL)
      if (existsSync(fileURLToPath(url))) {
        return {url: url.href, format: "module-typescript", shortCircuit: true}
      }
    }
    return nextResolve(specifier, context)
  },
})
