import { RecallApp } from "@/components/recall/recall-app";
import { getAiProviderLabel } from "@/lib/ai/provider";

export default function Page() {
  return <RecallApp providerLabel={getAiProviderLabel()} />;
}
