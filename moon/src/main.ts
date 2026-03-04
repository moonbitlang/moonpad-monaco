/*
 * Copyright 2025 International Digital Economy Academy
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { runSingleFile } from ".";
import "./styles.css";

const input = document.getElementById("code") as HTMLTextAreaElement;
const output = document.getElementById("output") as HTMLPreElement;
const runButton = document.getElementById("run") as HTMLButtonElement;

input.value = `fn main {
  println("hello moon")
}`;

async function runCode() {
  runButton.disabled = true;
  const result = await runSingleFile(input.value);
  if (result.kind === "success") {
    output.textContent = result.output;
  } else {
    output.textContent = result.message;
  }
  runButton.disabled = false;
}

runButton.addEventListener("click", () => {
  void runCode();
});

void runCode();
