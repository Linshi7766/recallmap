import { RecallApp } from "@/components/recall/recall-app";
import { getAiProviderLabel } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export default function Page() {
  return <RecallApp providerLabel={getAiProviderLabel()} />;
}
