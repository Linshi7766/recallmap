import { z } from "zod";

export const NodeStatusSchema = z.enum([
  "correct",
  "incomplete",
  "misconception",
]);

export const LessonSourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["sample", "pasted"]),
  title: z.string().min(1).max(120),
  text: z.string().min(240).max(12_000),
});

export const ChallengeSchema = z.object({
  lessonTitle: z.string().min(1).max(120),
  concept: z.string().min(2).max(100),
  prompt: z.string().min(20).max(400),
  evidencePassages: z.array(z.string().min(10).max(280)).min(1).max(3),
});

export const ReasoningNodeSchema = z.object({
  id: z.string().regex(/^node-[1-5]$/),
  claim: z.string().min(3).max(220),
  status: NodeStatusSchema,
  diagnosis: z.string().min(8).max(300),
  evidence: z.string().min(10).max(280),
  confidence: z.number().min(0).max(1),
});

export const DiagnosisSchema = z
  .object({
    nodes: z.array(ReasoningNodeSchema).min(3).max(5),
    priorityNodeId: z.string().regex(/^node-[1-5]$/).nullable(),
  })
  .superRefine((value, ctx) => {
    const nonCorrectNodes = value.nodes.filter(
      (node) => node.status !== "correct",
    );
    const hasValidPriority = value.nodes.some(
      (node) =>
        node.id === value.priorityNodeId && node.status !== "correct",
    );

    if (nonCorrectNodes.length === 0 && value.priorityNodeId !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["priorityNodeId"],
        message: "All-correct diagnoses require a null priority",
      });
    }

    if (nonCorrectNodes.length > 0 && !hasValidPriority) {
      ctx.addIssue({
        code: "custom",
        path: ["priorityNodeId"],
        message: "Priority must reference a non-correct node",
      });
    }
  });

export const ProbeSchema = z.object({
  question: z.string().min(15).max(420),
  evaluationTarget: z.string().min(8).max(300),
});

export const RepairNodeSchema = ReasoningNodeSchema.extend({
  previousStatus: NodeStatusSchema,
  repairExplanation: z.string().min(8).max(300),
});

export const RepairResultSchema = z
  .object({
    nodes: z.array(RepairNodeSchema).min(3).max(5),
    overallStatus: z.enum(["repaired", "partial", "not_repaired"]),
    before: z.string().min(8).max(360),
    after: z.string().min(8).max(360),
    recallCard: z.string().min(15).max(420).nullable(),
  })
  .superRefine((value, ctx) => {
    const hasCard = value.recallCard !== null;
    if (value.overallStatus === "repaired" && !hasCard) {
      ctx.addIssue({
        code: "custom",
        path: ["recallCard"],
        message: "Repaired outcomes require a recall card",
      });
    }

    if (value.overallStatus !== "repaired" && hasCard) {
      ctx.addIssue({
        code: "custom",
        path: ["recallCard"],
        message: "Unresolved outcomes must not provide a recall card",
      });
    }
  });

const SessionIdSchema = z.string().uuid();
const StudentExplanationSchema = z.string().min(80).max(4_000);

export const GenerateChallengeRequestSchema = z
  .object({
    operation: z.literal("generate_challenge"),
    sessionId: SessionIdSchema,
    source: LessonSourceSchema,
  })
  .strict();

export const DiagnoseRequestSchema = z
  .object({
    operation: z.literal("diagnose"),
    sessionId: SessionIdSchema,
    source: LessonSourceSchema,
    challenge: ChallengeSchema,
    firstExplanation: StudentExplanationSchema,
  })
  .strict();

export const VerifyRequestSchema = z
  .object({
    operation: z.literal("verify"),
    sessionId: SessionIdSchema,
    source: LessonSourceSchema,
    firstExplanation: StudentExplanationSchema,
    diagnosis: DiagnosisSchema,
    probe: ProbeSchema,
    revisedExplanation: StudentExplanationSchema,
  })
  .strict();

export const LearningRequestSchema = z.discriminatedUnion("operation", [
  GenerateChallengeRequestSchema,
  DiagnoseRequestSchema,
  VerifyRequestSchema,
]);

export type LessonSource = z.infer<typeof LessonSourceSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type ReasoningNode = z.infer<typeof ReasoningNodeSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type Probe = z.infer<typeof ProbeSchema>;
export type RepairNode = z.infer<typeof RepairNodeSchema>;
export type RepairResult = z.infer<typeof RepairResultSchema>;
export type LearningRequest = z.infer<typeof LearningRequestSchema>;
