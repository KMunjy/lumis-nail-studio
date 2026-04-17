/**
 * /challenge/[slug] — Challenge Mode redirect  (Feature 5)
 *
 * Server component. Resolves the slug to a challenge, then redirects to
 * the studio with shade/finish/challenge params pre-loaded.
 * The studio handles the creative experience; this page makes the
 * challenge URL meaningful (shareable, bookmarkable).
 */

import { redirect, notFound } from "next/navigation";
import { challenges } from "@/data/challenges";

interface ChallengePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { slug } = await params;
  const challenge = challenges.find((c) => c.slug === slug);
  if (!challenge) notFound();

  const target =
    `/studio/${challenge.productId}` +
    `?shade=${encodeURIComponent(challenge.shadeHex)}` +
    `&finish=${encodeURIComponent(challenge.finish)}` +
    `&challenge=${encodeURIComponent(challenge.slug)}`;

  redirect(target);
}

// Generate static paths for all known challenges
export function generateStaticParams() {
  return challenges.map((c) => ({ slug: c.slug }));
}
