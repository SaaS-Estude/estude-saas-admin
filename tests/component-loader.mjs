import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export function loadComponent(file, overrides = {}, extraExports = "") {
  const source = fs.readFileSync(
    new URL(`../${file}`, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source + extraExports, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) =>
      Object.hasOwn(overrides, name) ? overrides[name] : require(name),
    compiled,
    compiled.exports,
  );
  return compiled.exports;
}
