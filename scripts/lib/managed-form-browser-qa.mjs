import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertHostedCloud } from "../../load/cloud-actors.mjs";

// Functional browser regression, not a load generator. The browser is closed
// before the 100k measurement, and cannot reach production or submit a dossier.
export async function verifyManagedFormBrowser({ port, check }) {
  assertHostedCloud();
  assert.ok([3335, 3336, 3337].includes(port));
  const modulePath = process.env.CAPACITY_PLAYWRIGHT_MODULE;
  assert.ok(modulePath && path.isAbsolute(modulePath));
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${port}`;
  mkdirSync("output/playwright", { recursive: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      try {
        await context.route("**/*", (route) => {
          const request = route.request();
          if (new URL(request.url()).origin !== origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
          return route.continue();
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        const response = await page.goto(origin + "/demande-cours", { waitUntil: "networkidle" });
        assert.equal(response.status(), 200);
        const form = page.getByRole("form", { name: "Demande de cours" });
        console.log("CLOUD_FORM_INITIAL_SNAPSHOT " + JSON.stringify({ viewport, snapshot: await form.ariaSnapshot() }));
        assert.equal(await form.locator('[data-form-step="1"]').count(), 0);
        assert.equal(await form.locator('[data-form-step="2"]').count(), 0);
        await form.getByRole("button", { name: "Continuer", exact: true }).click();
        assert.equal(await form.getByRole("heading", { name: "Quel accompagnement ?" }).isVisible(), true, "Missing subject must still block the step");
        const subject = form.getByRole("combobox", { name: "Matière", exact: true });
        const value = await subject.locator('option:not([value=""])').first().getAttribute("value");
        assert.ok(value);
        await subject.selectOption(value);
        await form.getByRole("button", { name: "Continuer", exact: true }).click();
        await form.getByRole("heading", { name: "À votre rythme." }).waitFor();
        assert.equal(await form.locator('[data-form-step="0"]').count(), 1);
        assert.equal(await form.locator('[data-form-step="2"]').count(), 0);
        await form.getByRole("combobox", { name: "Séances par semaine" }).selectOption("4");
        await form.getByRole("combobox", { name: "Nombre de semaines" }).selectOption("4");
        const startDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
        await form.getByLabel("À partir du", { exact: true }).fill(startDate);
        assert.equal(await form.getByText("16 séances", { exact: true }).count(), 1);
        await form.getByText("Voir les 16 dates calculées", { exact: true }).click();
        const schedule = form.locator('[data-form-step="1"] details').first();
        assert.equal(await schedule.locator('strong').count(), 16);
        await form.getByRole("button", { name: "Continuer", exact: true }).click();
        await form.getByRole("heading", { name: "On vous rappelle." }).waitFor();
        await form.getByRole("textbox", { name: "Nom du parent", exact: true }).fill("Parent fictif QA");
        await form.getByRole("textbox", { name: "Téléphone", exact: true }).fill("0700000000");
        await form.getByRole("textbox", { name: "Commune", exact: true }).fill("Cocody");
        await form.getByRole("textbox", { name: "Quartier", exact: true }).fill("Angré QA");
        const totals = await form.locator('[aria-live="polite"][aria-atomic="true"]').innerText();
        assert.match(totals.replace(/[\s\u202f\u00a0]/g, ""), /200000FCFA/);
        await page.screenshot({ path: `output/playwright/cloud-form-${viewport.width}.png`, fullPage: true });
        await form.getByRole("button", { name: "Retour", exact: true }).click();
        await form.getByRole("button", { name: "Retour", exact: true }).click();
        assert.equal(await form.locator('[data-form-step="2"]').count(), 1, "Visited contact controls must not be unmounted");
        await form.getByRole("button", { name: "Continuer", exact: true }).click();
        assert.equal(await form.getByLabel("À partir du", { exact: true }).inputValue(), startDate);
        await form.getByRole("button", { name: "Continuer", exact: true }).click();
        assert.equal(await form.getByRole("textbox", { name: "Nom du parent", exact: true }).inputValue(), "Parent fictif QA");
        assert.equal(await form.getByRole("textbox", { name: "Téléphone", exact: true }).inputValue(), "0700000000");
        assert.equal(await form.getByRole("textbox", { name: "Quartier", exact: true }).inputValue(), "Angré QA");
        const values = await form.evaluate((element) => Object.fromEntries(new FormData(element)));
        assert.equal(values.parentName, "Parent fictif QA");
        assert.equal(values.phone, "0700000000");
        assert.equal(values.commune, "Cocody");
        assert.equal(await form.locator('[data-form-step]').count(), 3);
        assert.deepEqual(pageErrors, [], "No browser runtime/hydration errors");
        check(`Cloud Chromium ${viewport.width}px: deferred steps, validation, 16-session price, back navigation and FormData preserved`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
