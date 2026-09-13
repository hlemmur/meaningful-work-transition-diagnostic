#!/usr/bin/env node
/**
 * Score a persisted analysis artifact without calling Gemini.
 * Usage: npm run eval:framework -- path/to/artifact.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateFrameworkFidelity } from "../src/eval/framework-fidelity";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run eval:framework -- <artifact.json>");
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(resolve(path), "utf8"));
const result = evaluateFrameworkFidelity(artifact);
console.log(JSON.stringify(result, null, 2));
process.exit(result.hardPassed ? 0 : 2);
