import type {
  Diagnosis,
  RepairNode,
} from "@/lib/domain/contracts";

type NodeStatus = Diagnosis["nodes"][number]["status"];

const STATUS_LABEL: Record<NodeStatus, string> = {
  correct: "Supported",
  incomplete: "Incomplete",
  misconception: "Misconception",
};

type ReasoningMapProps = {
  diagnosis: Diagnosis;
  showChanges?: boolean;
};

function isRepairNode(node: Diagnosis["nodes"][number]): node is RepairNode {
  return "previousStatus" in node;
}

export function ReasoningMap({
  diagnosis,
  showChanges = false,
}: ReasoningMapProps) {
  return (
    <ol className="reasoning-map" aria-label="Reasoning map">
      {diagnosis.nodes.map((node, index) => {
        const isPriority = diagnosis.priorityNodeId === node.id;
        const tentative = node.confidence < 0.6;
        const repairNode = showChanges && isRepairNode(node) ? node : null;
        const repairedPriority =
          isPriority &&
          repairNode !== null &&
          repairNode.previousStatus !== "correct" &&
          repairNode.status === "correct";

        return (
          <li
            key={node.id}
            className="reasoning-node"
            data-status={node.status}
            aria-label={
              isPriority
                ? repairedPriority
                  ? "Previously highest-priority learning gap"
                  : "Highest-priority learning gap"
                : undefined
            }
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="node-topline">
              <span className="node-order">Link {index + 1}</span>
              <span className="node-status">
                <span className="status-icon" aria-hidden="true">
                  ●
                </span>
                {STATUS_LABEL[node.status]}
              </span>
            </div>
            {isPriority ? (
              <p className="priority-marker">
                {repairedPriority ? "Repaired priority gap" : "Priority gap"}
              </p>
            ) : null}
            <h3>{node.claim}</h3>
            <p className="node-diagnosis">{node.diagnosis}</p>
            {repairNode ? (
              <p className="repair-note">
                <span>Repair note</span>
                {repairNode.repairExplanation}
              </p>
            ) : null}
            <blockquote>
              <span>Source evidence</span>
              {node.evidence}
            </blockquote>
            <div className="node-meta">
              <span>{Math.round(node.confidence * 100)}% confidence</span>
              {tentative ? <span className="tentative">Tentative</span> : null}
            </div>
            {repairNode ? (
              <div className="status-change" aria-label="Status change">
                <span>Previous: {STATUS_LABEL[repairNode.previousStatus]}</span>
                <span aria-hidden="true">→</span>
                <span>Current: {STATUS_LABEL[repairNode.status]}</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
