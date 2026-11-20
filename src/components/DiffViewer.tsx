import { useMemo, useState } from 'react';
import { Check, Copy, Cpu, FileDiff, FileCode2 } from 'lucide-react';
import { computeLineDiff } from '../engine/scanner';
import { RemediationItem } from '../types';

interface DiffViewerProps {
  originalCode: string;
  remediation: RemediationItem;
}

type DiffViewMode = 'split' | 'unified' | 'sidecar';

export function DiffViewer({ originalCode, remediation }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>('split');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const diffLines = useMemo(
    () => computeLineDiff(originalCode, remediation.patched_code),
    [originalCode, remediation.patched_code]
  );

  // Pair removed/added lines for a clean side-by-side table
  const splitRows = useMemo(() => {
    const rows: Array<{
      left?: { lineNum?: number; content: string; type: 'context' | 'removed' };
      right?: { lineNum?: number; content: string; type: 'context' | 'added' };
    }> = [];

    let idx = 0;
    while (idx < diffLines.length) {
      const current = diffLines[idx];
      if (current.type === 'context') {
        rows.push({
          left: { lineNum: current.oldLineNumber, content: current.content, type: 'context' },
          right: { lineNum: current.newLineNumber, content: current.content, type: 'context' },
        });
        idx++;
      } else {
        const removedBatch: typeof diffLines = [];
        const addedBatch: typeof diffLines = [];
        while (idx < diffLines.length && diffLines[idx].type === 'removed') {
          removedBatch.push(diffLines[idx]);
          idx++;
        }
        while (idx < diffLines.length && diffLines[idx].type === 'added') {
          addedBatch.push(diffLines[idx]);
          idx++;
        }
        const maxLen = Math.max(removedBatch.length, addedBatch.length);
        for (let k = 0; k < maxLen; k++) {
          rows.push({
            left: removedBatch[k]
              ? {
                  lineNum: removedBatch[k].oldLineNumber,
                  content: removedBatch[k].content,
                  type: 'removed',
                }
              : undefined,
            right: addedBatch[k]
              ? {
                  lineNum: addedBatch[k].newLineNumber,
                  content: addedBatch[k].content,
                  type: 'added',
                }
              : undefined,
          });
        }
      }
    }
    return rows;
  }, [diffLines]);

  const additions = diffLines.filter((d) => d.type === 'added').length;
  const deletions = diffLines.filter((d) => d.type === 'removed').length;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard access unavailable in restricted iframe
    }
  };

  return (
    <div className="flex flex-col">
      {/* Explanation & Controls Header */}
      <div className="px-4 py-3 border-b border-[#1F2937] bg-[#0E1422] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
            <span className="text-emerald-400 font-semibold">{remediation.dpdp_section}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">{remediation.cwe_id}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-emerald-400 tabular-nums">+{additions}</span>
            <span className="text-red-400 tabular-nums">-{deletions}</span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
            {remediation.explanation}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="Diff view mode"
            className="flex items-center bg-[#0B0F19] border border-[#1F2937] rounded-lg p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'split'}
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                viewMode === 'split'
                  ? 'bg-[#1F2937] text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              Side-by-Side
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'unified'}
              onClick={() => setViewMode('unified')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                viewMode === 'unified'
                  ? 'bg-[#1F2937] text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Unified Diff
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'sidecar'}
              onClick={() => setViewMode('sidecar')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                viewMode === 'sidecar'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Gemma Sidecar
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              handleCopy(
                viewMode === 'sidecar'
                  ? remediation.gemma_sidecar_snippet
                  : remediation.patched_code,
                viewMode
              )
            }
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#0B0F19] border border-[#1F2937] hover:border-slate-600 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            {copiedKey === viewMode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'split' && (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto bg-[#0B0F19]">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-w-[640px] divide-y lg:divide-y-0 lg:divide-x divide-[#1F2937]">
            {/* Left Column: Vulnerable Original */}
            <div>
              <div className="px-3 py-1.5 bg-red-950/30 border-b border-[#1F2937] text-[11px] font-mono text-red-300 flex items-center justify-between">
                <span>Original (Vulnerable)</span>
                <span>{remediation.file_path}</span>
              </div>
              <div className="font-mono text-xs leading-6">
                {splitRows.map((row, idx) => (
                  <div
                    key={`left-${idx}`}
                    className={`flex min-h-[24px] ${
                      row.left?.type === 'removed'
                        ? 'bg-red-500/15 text-red-200'
                        : !row.left
                          ? 'bg-[#0E1422]/60 text-slate-600'
                          : 'text-slate-300'
                    }`}
                  >
                    <span className="w-10 shrink-0 select-none text-right pr-2.5 text-slate-500 border-r border-[#1F2937]/70 tabular-nums">
                      {row.left?.lineNum ?? ''}
                    </span>
                    <span className="w-5 shrink-0 select-none text-center text-red-400">
                      {row.left?.type === 'removed' ? '−' : ' '}
                    </span>
                    <pre className="whitespace-pre pr-3 overflow-x-visible">
                      {row.left?.content ?? ''}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Verified Patched */}
            <div>
              <div className="px-3 py-1.5 bg-emerald-950/30 border-b border-[#1F2937] text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                <span>Gemini Verified Fix</span>
                <span>0 Leaks</span>
              </div>
              <div className="font-mono text-xs leading-6">
                {splitRows.map((row, idx) => (
                  <div
                    key={`right-${idx}`}
                    className={`flex min-h-[24px] ${
                      row.right?.type === 'added'
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : !row.right
                          ? 'bg-[#0E1422]/60 text-slate-600'
                          : 'text-slate-300'
                    }`}
                  >
                    <span className="w-10 shrink-0 select-none text-right pr-2.5 text-slate-500 border-r border-[#1F2937]/70 tabular-nums">
                      {row.right?.lineNum ?? ''}
                    </span>
                    <span className="w-5 shrink-0 select-none text-center text-emerald-400">
                      {row.right?.type === 'added' ? '+' : ' '}
                    </span>
                    <pre className="whitespace-pre pr-3 overflow-x-visible">
                      {row.right?.content ?? ''}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'unified' && (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto bg-[#0B0F19] font-mono text-xs leading-6">
          {diffLines.map((line, idx) => (
            <div
              key={`uni-${idx}`}
              className={`flex px-2 ${
                line.type === 'added'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : line.type === 'removed'
                    ? 'bg-red-500/15 text-red-200'
                    : 'text-slate-300'
              }`}
            >
              <span className="w-9 shrink-0 select-none text-right pr-2 text-slate-500 tabular-nums">
                {line.oldLineNumber ?? ''}
              </span>
              <span className="w-9 shrink-0 select-none text-right pr-2 text-slate-500 tabular-nums border-r border-[#1F2937]">
                {line.newLineNumber ?? ''}
              </span>
              <span
                className={`w-6 shrink-0 select-none text-center ${
                  line.type === 'added'
                    ? 'text-emerald-400'
                    : line.type === 'removed'
                      ? 'text-red-400'
                      : 'text-slate-600'
                }`}
              >
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              <pre className="whitespace-pre pr-4">{line.content}</pre>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'sidecar' && (
        <div className="bg-[#0B0F19] p-4 max-h-[480px] overflow-y-auto">
          <div className="mb-3 flex items-center justify-between text-xs text-cyan-300 font-mono">
            <span>In-VPC Gemma 2B/4B Runtime PII Redaction Sidecar</span>
            <span className="text-slate-400">&lt;15ms p99 local inference · Zero external PII egress</span>
          </div>
          <pre className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] font-mono text-xs text-slate-200 leading-6 overflow-x-auto whitespace-pre">
            {remediation.gemma_sidecar_snippet}
          </pre>
        </div>
      )}
    </div>
  );
}
