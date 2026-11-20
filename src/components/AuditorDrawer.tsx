import { useEffect, useRef, useState } from 'react';
import {
  FileCode2,
  Loader2,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AuditorMessage, RemediationBundle, ScanResult } from '../types';

interface AuditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scanResult: ScanResult | null;
  remediationBundle: RemediationBundle | null;
  prMeta: { prId: string; repoName: string };
  onJumpToLocation: (fileLine: string) => void;
}

const AUDITOR_PRESETS = [
  'Is customer PII ever sent unredacted to external LLMs?',
  'Does our database schema comply with DPDP Sec 8(7) data erasure?',
  'How did Sentinel handle the # sentinel-ignore bypass attempt?',
  'Are Aadhaar and PAN numbers protected from log exfiltration under Sec 8(5)?',
];

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function AuditorDrawer({
  isOpen,
  onClose,
  scanResult,
  remediationBundle,
  prMeta,
  onJumpToLocation,
}: AuditorDrawerProps) {
  const [messages, setMessages] = useState<AuditorMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Enterprise Compliance Auditor ready. Ask any question about PII data flows, DPDP Act 2023 statutory sections, neutralized bypass directives, or verified patches in the active PR.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, [isOpen]);

  const toggleVoiceInput = () => {
    setSpeechNotice(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechNotice('Browser Speech-to-Text is not available in this browser. Please type your question.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript.trim());
      };

      recognition.onerror = (evt) => {
        setIsListening(false);
        setSpeechNotice(
          evt.error === 'not-allowed'
            ? 'Microphone permission denied. Allow microphone access or type your question.'
            : `Voice capture stopped (${evt.error}).`
        );
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setSpeechNotice('Could not start voice capture. Please type your question below.');
    }
  };

  const handleAsk = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg: AuditorMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const currentRisk =
        remediationBundle?.verification.passed
          ? remediationBundle.verification.postPatchRiskScore
          : (scanResult?.riskScore ?? 0);

      const res = await fetch('/api/auditor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: nextMessages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, content: m.content })),
          scanContext: {
            prId: prMeta.prId,
            repoName: prMeta.repoName,
            riskScore: currentRisk,
            status:
              remediationBundle?.verification.passed
                ? 'SAFE_TO_MERGE_VERIFIED'
                : scanResult
                  ? scanResult.status
                  : 'NOT_SCANNED_YET',
            hasScanned: Boolean(scanResult),
            hasVerifiedPatches: Boolean(remediationBundle?.verification.passed),
            appliedCommitSha: remediationBundle?.appliedCommitSha,
            findings: (scanResult?.findings ?? []).map((f) => ({
              filePath: f.filePath,
              line: f.line,
              dpdpSection: f.dpdpSection,
              cweId: f.cweId,
              severity: f.severity,
              title: f.title,
              description: f.description,
              snippet: f.snippet,
            })),
            bypassAttempts: scanResult?.bypassAttempts ?? [],
            remediations: remediationBundle?.remediations.map((r) => ({
              file_path: r.file_path,
              dpdp_section: r.dpdp_section,
              cwe_id: r.cwe_id,
              explanation: r.explanation,
            })),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Auditor request failed.');
      }

      const assistantMsg: AuditorMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        citations: data.citations ?? [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Compliance Auditor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Ask AI Compliance Auditor"
    >
      {/* Clickable backdrop */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <aside className="w-full max-w-[480px] bg-[#0B0F19] border-l border-[#1F2937] flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1F2937] bg-[#111827] flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-100 font-display">
                AI Compliance Auditor
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Grounded in {prMeta.repoName} {prMeta.prId} ·{' '}
              {remediationBundle?.verification.passed
                ? 'Verified (0 Leaks)'
                : scanResult
                  ? `${scanResult.findings.length} Active Findings`
                  : 'Run scan for line citations'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Compliance Auditor drawer"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1F2937] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Auditor Queries */}
        <div className="px-5 py-3 border-b border-[#1F2937] bg-[#0E1422]">
          <p className="text-[11px] font-medium text-slate-400 mb-2">
            Enterprise Audit Prompts (HDFC / Mastercard / RBI InfoSec)
          </p>
          <div className="flex flex-col gap-1.5">
            {AUDITOR_PRESETS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isLoading}
                onClick={() => handleAsk(q)}
                className="text-left text-xs text-slate-300 hover:text-cyan-300 bg-[#111827] hover:bg-[#162033] border border-[#1F2937] rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Feed */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-50'
                    : 'bg-[#111827] border border-[#1F2937] text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#1F2937] flex flex-wrap gap-2">
                    {msg.citations.map((cit, i) => (
                      <button
                        key={`${cit.fileLine}-${i}`}
                        type="button"
                        onClick={() => {
                          onJumpToLocation(cit.fileLine);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#0B0F19] border border-[#1F2937] hover:border-cyan-500/50 text-[11px] font-mono text-cyan-300 transition-colors"
                      >
                        <FileCode2 className="w-3 h-3" />
                        <span>{cit.fileLine}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{cit.dpdpSection}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">
                {msg.role === 'user' ? 'Auditor' : 'Sentinel-DPDP'} · {msg.timestamp}
              </span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-cyan-300 bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Auditing AST evidence &amp; DPDP Act clauses...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* Input Composer with Voice STT */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(input);
          }}
          className="p-4 border-t border-[#1F2937] bg-[#111827]"
        >
          {speechNotice && (
            <p className="text-[11px] text-amber-300 mb-2">{speechNotice}</p>
          )}
          {isListening && (
            <p className="text-[11px] text-cyan-300 font-mono mb-2">
              Listening via Web Speech API (en-IN)... speak your audit query.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop voice input' : 'Voice input (Speech-to-Text)'}
              className={`p-2.5 rounded-lg border transition-colors shrink-0 ${
                isListening
                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-[#0B0F19] border-[#1F2937] text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about PII egress, DPDP Sec 6 / 8(5) / 8(7)..."
              className="flex-1 bg-[#0B0F19] border border-[#1F2937] focus:border-cyan-500 focus:outline-none rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Ask
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
