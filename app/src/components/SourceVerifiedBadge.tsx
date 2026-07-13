/**
 * SourceVerifiedBadge — LAYER 3 OF THE AQIDAH WALL (UI).
 *
 * Every rendered aqidah content item must show this badge. It signals to
 * parents and teachers that this text is human-provided from an authorized
 * source and approved by the approver role — never AI-generated.
 */

import { ShieldCheck } from "lucide-react";
import type { Content } from "@/lib/types";

export function SourceVerifiedBadge({ sourceReference }: { sourceReference: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-verified/10 px-3 py-1 text-sm font-semibold text-verified"
      title={sourceReference ? `Kilde: ${sourceReference}` : undefined}
    >
      <ShieldCheck size={16} aria-hidden />
      Kilde-verificeret
    </span>
  );
}

/** Convenience: renders the badge iff the content is aqidah. */
export function ContentTypeBadge({ content }: { content: Content }) {
  if (content.content_type !== "aqidah") return null;
  return <SourceVerifiedBadge sourceReference={content.source_reference} />;
}
