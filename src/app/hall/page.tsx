import { Suspense } from "react";
import { HallClient } from "./HallClient";

export default function HallPage() {
  return (
    <Suspense fallback={null}>
      <HallClient />
    </Suspense>
  );
}
