import { expect, test, type Page, type Route } from "@playwright/test";
import {
  DiagnosisSchema,
  LearningRequestSchema,
  ProbeSchema,
  RepairResultSchema,
} from "../src/lib/domain/contracts";
import {
  DEMO_FIRST_EXPLANATION,
  DEMO_REVISED_EXPLANATION,
  SAMPLE_LESSON,
} from "../src/lib/domain/sample-lesson";
import { assertRepairMatchesDiagnosis } from "../src/lib/domain/repair";
import {
  DEMO_CHALLENGE,
  DEMO_DIAGNOSIS,
  DEMO_PROBE,
  DEMO_REPAIR,
} from "../src/lib/fixtures/demo-fallback";

const STORAGE_KEY = "recall.session.v1";

const ALL_CORRECT_FIRST_EXPLANATION =
  "Correlation describes how two variables vary together. An association can have several explanations, so a causal conclusion requires evidence that rules out alternatives.";

const TRANSFER_REVISED_EXPLANATION =
  "I would first test whether holiday demand, shared promotions, timing, or chance raised both products' sales, then seek controlled or longitudinal evidence before claiming that either product caused the other to sell.";

const ALL_CORRECT_DIAGNOSIS = DiagnosisSchema.parse({
  nodes: [
    {
      id: "node-1",
      claim: "Correlation describes how two variables vary together.",
      status: "correct",
      diagnosis: "This accurately defines what correlation measures.",
      evidence: "Correlation measures how two variables vary together.",
      confidence: 0.98,
    },
    {
      id: "node-2",
      claim: "An association can have several explanations.",
      status: "correct",
      diagnosis: "This correctly leaves room for reverse and common causes.",
      evidence:
        "An association may arise because one variable causes the other, because causation runs in the reverse direction, because a third variable affects both, because of selection bias, or because of chance.",
      confidence: 0.93,
    },
    {
      id: "node-3",
      claim: "A causal conclusion requires evidence that rules out alternatives.",
      status: "correct",
      diagnosis: "This states the additional standard for a causal claim.",
      evidence:
        "Establishing causation requires a credible design or additional evidence that rules out alternative explanations.",
      confidence: 0.91,
    },
  ],
  priorityNodeId: null,
});

const TRANSFER_PROBE = ProbeSchema.parse({
  question:
    "Two products sell more during a holiday week. What evidence would you seek before claiming that one caused the other to sell?",
  evaluationTarget:
    "Whether the learner transfers the need to rule out alternative explanations.",
});

const TRANSFER_REPAIR = RepairResultSchema.parse({
  nodes: ALL_CORRECT_DIAGNOSIS.nodes.map((node) => ({
    ...node,
    previousStatus: node.status,
    repairExplanation:
      "The transfer response preserves this source-supported reasoning link.",
  })),
  overallStatus: "repaired",
  before: ALL_CORRECT_FIRST_EXPLANATION,
  after: TRANSFER_REVISED_EXPLANATION,
  recallCard: ALL_CORRECT_DIAGNOSIS.nodes[2]!.claim,
});

assertRepairMatchesDiagnosis(ALL_CORRECT_DIAGNOSIS, TRANSFER_REPAIR);

function success(data: unknown) {
  return { ok: true, data, fallback: false };
}

async function fulfillSuccess(route: Route, data: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", json: success(data) });
}

async function mockDemoApi(
  page: Page,
  options: { failDiagnosisOnce?: boolean; allCorrect?: boolean } = {},
) {
  let diagnosisAttempts = 0;
  const expectedFirstExplanation = options.allCorrect
    ? ALL_CORRECT_FIRST_EXPLANATION
    : DEMO_FIRST_EXPLANATION;
  const expectedRevisedExplanation = options.allCorrect
    ? TRANSFER_REVISED_EXPLANATION
    : DEMO_REVISED_EXPLANATION;

  await page.route("**/api/learn", async (route) => {
    const request = LearningRequestSchema.parse(route.request().postDataJSON());

    if (request.operation === "generate_challenge") {
      expect(request.source).toEqual(SAMPLE_LESSON);
      await fulfillSuccess(route, DEMO_CHALLENGE);
      return;
    }

    if (request.operation === "diagnose") {
      diagnosisAttempts += 1;
      expect(request.challenge).toEqual(DEMO_CHALLENGE);
      expect(request.firstExplanation).toBe(expectedFirstExplanation);
      if (options.failDiagnosisOnce && diagnosisAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          json: {
            ok: false,
            error: {
              code: "MODEL_UNAVAILABLE",
              message: "Learning service is temporarily unavailable.",
            },
          },
        });
        return;
      }
      await fulfillSuccess(
        route,
        options.allCorrect
          ? { diagnosis: ALL_CORRECT_DIAGNOSIS, probe: TRANSFER_PROBE }
          : { diagnosis: DEMO_DIAGNOSIS, probe: DEMO_PROBE },
      );
      return;
    }

    expect(request.firstExplanation).toBe(expectedFirstExplanation);
    expect(request.revisedExplanation).toBe(expectedRevisedExplanation);
    expect(request.diagnosis).toEqual(
      options.allCorrect ? ALL_CORRECT_DIAGNOSIS : DEMO_DIAGNOSIS,
    );
    expect(request.probe).toEqual(options.allCorrect ? TRANSFER_PROBE : DEMO_PROBE);
    await fulfillSuccess(route, options.allCorrect ? TRANSFER_REPAIR : DEMO_REPAIR);
  });
}

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /start sample lesson/i }).click();
  await expect(page.getByRole("heading", { name: DEMO_CHALLENGE.prompt })).toBeVisible();
}

async function reachDiagnosis(
  page: Page,
  firstExplanation = DEMO_FIRST_EXPLANATION,
) {
  await startDemo(page);
  await page.getByLabel(/your explanation/i).fill(firstExplanation);
  await page.getByRole("button", { name: /reveal my blind spot/i }).click();
}

async function expectAccessibleProgress(
  page: Page,
  currentStep: "Choose" | "Teach Back" | "Challenge" | "Verify",
) {
  const progress = page.getByRole("navigation", { name: /lesson progress/i });
  await expect(
    progress.getByRole("listitem").filter({ hasText: currentStep }),
  ).toHaveAttribute("aria-current", "step");

  const inactiveColors = await progress
    .locator("li:not([aria-current='step'])")
    .evaluateAll((items) =>
      items.map((item) => getComputedStyle(item).color),
    );
  expect(inactiveColors).toEqual(
    inactiveColors.map(() => "rgb(100, 116, 139)"),
  );

  const contrastOnWhite = await progress
    .locator("li:not([aria-current='step'])")
    .first()
    .evaluate((item) => {
      const channels = getComputedStyle(item)
        .color.match(/\d+/g)!
        .slice(0, 3)
        .map(Number);
      const luminance = (rgb: number[]) => {
        const linear = rgb.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
      };
      const foreground = luminance(channels);
      const white = luminance([255, 255, 255]);
      return (white + 0.05) / (foreground + 0.05);
    });
  expect(contrastOnWhite).toBeGreaterThanOrEqual(4.5);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test("student reveals and repairs a misconception", async ({ page }) => {
  await mockDemoApi(page);
  await reachDiagnosis(page);

  await expect(page.getByLabel(/highest-priority learning gap/i)).toContainText(
    /direct causation|causation/i,
  );
  await page.getByRole("button", { name: /work through this challenge/i }).click();
  await page.getByLabel(/revised explanation/i).fill(DEMO_REVISED_EXPLANATION);
  await page
    .getByRole("button", { name: /check my repaired understanding/i })
    .click();

  await expect(
    page.getByRole("heading", { name: /understanding repaired/i }),
  ).toBeVisible();
  await expect(page.getByText(DEMO_REPAIR.before)).toBeVisible();
  await expect(page.getByText(DEMO_REPAIR.after)).toBeVisible();
});

test("a one-time diagnosis failure preserves the exact answer and retries", async ({
  page,
}) => {
  await mockDemoApi(page, { failDiagnosisOnce: true });
  await startDemo(page);
  const explanation = page.getByLabel(/your explanation/i);
  await explanation.fill(DEMO_FIRST_EXPLANATION);
  await page.getByRole("button", { name: /reveal my blind spot/i }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: /temporarily unavailable/i }),
  ).toContainText(/temporarily unavailable/i);
  await expect(explanation).toHaveValue(DEMO_FIRST_EXPLANATION);
  await page.getByRole("button", { name: /retry analysis/i }).click();

  await expect(page.getByLabel(/highest-priority learning gap/i)).toBeVisible();
  await page.getByRole("button", { name: /work through this challenge/i }).click();
  await page.getByLabel(/revised explanation/i).fill(DEMO_REVISED_EXPLANATION);
  await page
    .getByRole("button", { name: /check my repaired understanding/i })
    .click();
  await expect(
    page.getByRole("heading", { name: /understanding repaired/i }),
  ).toBeVisible();
});

test("teachback prompt and typed explanation restore after refresh on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDemoApi(page);
  await startDemo(page);
  const explanation = page.getByLabel(/your explanation/i);
  await explanation.fill(DEMO_FIRST_EXPLANATION);
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, answer }) => {
          const stored = window.localStorage.getItem(key);
          return stored ? JSON.parse(stored).firstExplanation === answer : false;
        },
        { key: STORAGE_KEY, answer: DEMO_FIRST_EXPLANATION },
      ),
    )
    .toBe(true);

  await page.reload();

  await expect(page.getByRole("heading", { name: DEMO_CHALLENGE.prompt })).toBeVisible();
  await expect(page.getByLabel(/your explanation/i)).toHaveValue(
    DEMO_FIRST_EXPLANATION,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  const primary = await page
    .getByRole("button", { name: /reveal my blind spot/i })
    .boundingBox();
  const secondary = await page.getByRole("button", { name: /^back$/i }).boundingBox();
  expect(primary).not.toBeNull();
  expect(secondary).not.toBeNull();
  expect(primary!.y).toBeLessThan(secondary!.y);
});

test("an all-correct diagnosis produces a successful transfer result", async ({
  page,
}) => {
  await mockDemoApi(page, { allCorrect: true });
  await reachDiagnosis(page, ALL_CORRECT_FIRST_EXPLANATION);

  await expect(
    page.getByRole("heading", { name: /no clear misconception found/i }),
  ).toBeVisible();
  await expect(page.getByText("Transfer question", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/highest-priority learning gap/i)).toHaveCount(0);
  await page.getByRole("button", { name: /work through this challenge/i }).click();
  await page
    .getByLabel(/revised explanation/i)
    .fill(TRANSFER_REVISED_EXPLANATION);
  await page
    .getByRole("button", { name: /check my repaired understanding/i })
    .click();

  await expect(page.getByRole("heading", { name: /transfer confirmed/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /recall card/i })).toBeVisible();
  await expect(page.getByText(TRANSFER_REPAIR.before)).toBeVisible();
  await expect(page.getByText(TRANSFER_REPAIR.after)).toBeVisible();
  await expect(
    page
      .getByLabel(/recall card/i)
      .getByText(TRANSFER_REPAIR.recallCard!, { exact: true }),
  ).toBeVisible();
});

for (const viewport of [
  { label: "desktop", width: 1280, height: 900 },
  { label: "390px", width: 390, height: 844 },
]) {
  test(`progress states keep accessible contrast and no overflow at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockDemoApi(page);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /start sample lesson/i }),
    ).toBeEnabled();
    await expectAccessibleProgress(page, "Choose");

    await page.getByRole("button", { name: /start sample lesson/i }).click();
    await expect(page.getByRole("heading", { name: DEMO_CHALLENGE.prompt })).toBeVisible();
    await expectAccessibleProgress(page, "Teach Back");

    await page.getByLabel(/your explanation/i).fill(DEMO_FIRST_EXPLANATION);
    await page.getByRole("button", { name: /reveal my blind spot/i }).click();
    await expect(page.getByLabel(/highest-priority learning gap/i)).toBeVisible();
    await expectAccessibleProgress(page, "Challenge");

    await page.getByRole("button", { name: /work through this challenge/i }).click();
    await expect(page.getByLabel(/revised explanation/i)).toBeVisible();
    await expectAccessibleProgress(page, "Challenge");
    await page.getByLabel(/revised explanation/i).fill(DEMO_REVISED_EXPLANATION);
    await page
      .getByRole("button", { name: /check my repaired understanding/i })
      .click();

    await expect(
      page.getByRole("heading", { name: /understanding repaired/i }),
    ).toBeVisible();
    await expectAccessibleProgress(page, "Verify");
  });
}
