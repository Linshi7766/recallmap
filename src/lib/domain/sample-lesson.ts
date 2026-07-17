import type { LessonSource } from "./contracts";

export const SAMPLE_LESSON: LessonSource = {
  id: "correlation-causation",
  kind: "sample",
  title: "Correlation vs. Causation",
  text: "Correlation measures how two variables vary together. Correlation alone does not identify the mechanism that produced an association. An association may arise because one variable causes the other, because causation runs in the reverse direction, because a third variable affects both, because of selection bias, or because of chance. For example, ice-cream sales and drowning incidents both rise during hot weather. Their correlation does not mean that buying ice cream causes drowning; temperature is a common cause that influences both variables. Establishing causation requires a credible design or additional evidence that rules out alternative explanations.",
};

export const DEMO_FIRST_EXPLANATION =
  "If two variables consistently move together, one probably causes the other unless the data has an error.";

export const DEMO_REVISED_EXPLANATION =
  "Correlation shows that variables move together, but it does not reveal why. The association may come from direct causation, reverse causation, a common cause such as temperature, selection bias, or chance, so additional evidence is required.";
