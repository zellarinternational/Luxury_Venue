import { Suspense } from "react";
import { ShareClient } from "./ShareClient";

export default async function SharePage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  return (
    <Suspense fallback={null}>
      <ShareClient shortCode={shortCode} />
    </Suspense>
  );
}
