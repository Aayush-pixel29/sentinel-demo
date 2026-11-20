import { CheckCircle2, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { VerificationResult } from '../types';

interface RiskGaugeProps {
  score: number | null;
  hasScanned: boolean;
  verification: VerificationResult | null;
  findingsCount: number;
  bypassCount: number;
  appliedCommitSha?: string;
}

export function RiskGauge({
  score,
  hasScanned,
  verification,
  findingsCount,
  bypassCount,
  appliedCommitSha,
}: RiskGaugeProps) {
  const displayScore = score ?? 0;
  const radius = 64;
  const circumference = Math.PI * radius; // Semi-circle arc length
  const clamped = Math.max(0, Math.min(100, displayScore));
  const strokeOffset = circumference - (clamped / 100) * circumference;

  const isCritical = hasScanned && displayScore >= 60;
  const isMedium = hasScanned && displayScore > 0 && displayScore < 60;
  const isSafe = hasScanned && displayScore === 0;

  const strokeColor = !hasScanned
    ? '#334155'
    : isCritical
      ? '#EF4444'
      : isMedium
        ? '#F59E0B'
        : '#10B981';

  const statusText = !hasScanned
    ? 'Awaiting AST Scan'
    : isCritical
      ? 'CRITICAL — Merge Blocked'
      : isMedium
        ? 'ELEVATED — Review Required'
        : 'SAFE TO MERGE';

  const statusColorClass = !hasScanned
    ? 'text-slate-400'
    : isCritical
      ? 'text-red-400'
      : isMedium
        ? 'text-amber-400'
        : 'text-emerald-400';

  return (
    <section
      aria-label="DPDP Risk Score Gauge"
      className="bg-[#111827] border border-[#1F2937] rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 font-display">
            PR Risk Score &amp; Merge Gate
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic DPDP Act 2023 statutory weighting
          </p>
        </div>
        {!hasScanned ? (
          <ShieldOff className="w-5 h-5 text-slate-500" aria-hidden="true" />
        ) : isSafe ? (
          <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-red-400" aria-hidden="true" />
        )}
      </div>

      {/* Semi-circle SVG Gauge */}
      <div className="flex flex-col items-center pt-2 pb-1">
        <div className="relative w-48 h-28 flex items-end justify-center">
          <svg
            viewBox="0 0 160 92"
            className="w-full h-full overflow-visible"
            role="img"
            aria-label={`Risk score ${hasScanned ? displayScore : 0} out of 100`}
          >
            {/* Track */}
            <path
              d="M 16 80 A 64 64 0 0 1 144 80"
              fill="none"
              stroke="#1F2937"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Active Progress Arc */}
            <path
              d="M 16 80 A 64 64 0 0 1 144 80"
              fill="none"
              stroke={strokeColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={hasScanned ? strokeOffset : circumference}
              style={{
                transition: 'stroke-dashoffset 650ms cubic-bezier(0.16, 1, 0.3, 1), stroke 350ms ease',
              }}
            />
          </svg>
          <div className="absolute bottom-1 flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight font-mono tabular-nums text-slate-50">
                {hasScanned ? displayScore : '—'}
              </span>
              <span className="text-sm font-mono text-slate-400">/ 100</span>
            </div>
          </div>
        </div>

        <p className={`mt-2 text-xs font-semibold tracking-wide ${statusColorClass}`}>
          {statusText}
        </p>
      </div>

      {/* Verification Gate Banner */}
      {verification && (
        <div
          className={`mt-4 px-3.5 py-2.5 rounded-lg border flex items-start gap-2.5 ${
            verification.passed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {verification.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed">
            <p className="font-mono font-semibold">
              {verification.passed
                ? 'verify_patch.py PASSED — 0 Regressions'
                : `verify_patch.py BLOCKED — ${verification.remainingFindings.length} Residual Leak(s)`}
            </p>
            <p className="text-slate-300/90 mt-0.5">
              {verification.passed
                ? `Re-scanned ${verification.filesVerified} patched file(s) in ${verification.verificationDurationMs}ms. Merge gate unlocked.`
                : 'Deterministic re-scan detected remaining violations. Trigger re-synthesis with gate feedback.'}
            </p>
          </div>
        </div>
      )}

      {/* Commit Applied Confirmation */}
      {appliedCommitSha && (
        <div className="mt-3 px-3.5 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between gap-2">
          <span>PR Commit Applied</span>
          <span className="font-mono text-cyan-300">{appliedCommitSha}</span>
        </div>
      )}

      {/* Quiet Key-Value Summary */}
      <dl className="mt-4 pt-3.5 border-t border-[#1F2937] grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-slate-400">Open Leaks</dt>
          <dd
            className={`text-base font-mono font-semibold tabular-nums mt-0.5 ${
              !hasScanned
                ? 'text-slate-500'
                : findingsCount > 0
                  ? 'text-red-400'
                  : 'text-emerald-400'
            }`}
          >
            {hasScanned ? findingsCount : '—'}
          </dd>
        </div>
        <div className="border-x border-[#1F2937]">
          <dt className="text-[11px] text-slate-400">Bypasses Blocked</dt>
          <dd className="text-base font-mono font-semibold tabular-nums text-amber-300 mt-0.5">
            {hasScanned ? bypassCount : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-400">Gate Status</dt>
          <dd
            className={`text-xs font-mono font-semibold mt-1.5 ${
              !hasScanned
                ? 'text-slate-500'
                : isSafe
                  ? 'text-emerald-400'
                  : 'text-red-400'
            }`}
          >
            {!hasScanned ? 'IDLE' : isSafe ? 'UNBLOCKED' : 'BLOCKED'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
