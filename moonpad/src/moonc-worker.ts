import { buildPackage, linkCore } from "@moonbit/moonc-worker";
import { expose } from "comlink";

const compiler = { buildPackage, linkCore };

expose(compiler);

export type Compiler = typeof compiler;
