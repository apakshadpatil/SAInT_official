import { CheckCircle2 } from 'lucide-react';
import type { UserProfile } from '../../types';

interface VerifiedBadgeProps {
  user?: UserProfile | null;
  className?: string;
}

export default function VerifiedBadge({ user, className = '' }: VerifiedBadgeProps) {
  const isVerified = Boolean(user && (user.role === 'core' || user.positionTitle?.trim()));

  if (!isVerified) return null;

  return (
    <CheckCircle2
      className={`ml-1 h-4 w-4 shrink-0 text-blue-500 ${className}`.trim()}
      aria-label="Verified member"
    />
  );
}
