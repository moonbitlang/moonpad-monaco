import { expect, test, type Page } from "@playwright/test";

async function edit(page: Page, code: string) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((code) => navigator.clipboard.writeText(code), code);
  await page.locator(".monaco-editor textarea").focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ControlOrMeta+V");
}

test("compiled package runs, reports type errors and recovers with value tracing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await edit(page, "fn main { let answer = 42; println(answer) }");
  await expect(page.locator("#output")).toHaveText("42");
  await expect(page.locator(".moonbit-trace")).toContainText(["answer = 42"]);

  await edit(page, 'fn main { let answer : Int = "wrong"; println(answer) }');
  await expect(page.locator(".squiggly-error").first()).toBeVisible();
  await expect(page.locator("#output")).toContainText("Int");
  await expect(page.locator("#output")).not.toHaveText("42");

  await edit(page, "fn main { let answer = 7; println(answer) }");
  await expect(page.locator("#output")).toHaveText("7");
  await expect(page.locator(".squiggly-error")).toHaveCount(0);
  await expect(page.locator(".moonbit-trace")).toContainText(["answer = 7"]);
  expect(errors).toEqual([]);
});

test("editing cancels a running program and displays only the new result", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#output")).toContainText("3");
  let workers = 0;
  page.on("worker", () => workers++);
  await edit(page, 'fn main { println("old"); while true {} }');
  // Build, link and execution each start a worker. Wait until execution starts.
  await expect.poll(() => workers).toBeGreaterThanOrEqual(3);
  await edit(page, 'fn main { println("new") }');
  await expect(page.locator("#output")).toHaveText("new");
  await expect
    .poll(
      () =>
        page.workers().filter((worker) => worker.url().startsWith("blob:"))
          .length,
    )
    .toBe(0);
});
