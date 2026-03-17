/**
 * @file SeedModal.tsx
 * @description Captures a new scenario seed and performs the prototype's local simulation reset.
 * @ai_context This modal is the frontend contract for the future Rust `seed.inject` command and `seed.applied` response cycle.
 */
import { memo, useCallback, useState } from 'react';
import { X, FlaskConical, Zap, AlertTriangle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { sendCommand } from '../../services/wsClient';
import { cn } from '../../lib/utils';

const TARGET_AUDIENCES = [
  'Early Adopters (Tech-Savvy)',
  'Mass Market Consumers',
  'Enterprise B2B',
  'Government & Institutions',
  'Developer Community',
  'Academic Researchers',
  'Financial Institutions',
];

export const SeedModal = memo(function SeedModal() {
  const { isSeedModalOpen, closeSeedModal } = useWorldStore(
    useShallow((state) => ({
      isSeedModalOpen: state.isSeedModalOpen,
      closeSeedModal: state.closeSeedModal,
    }))
  );
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isSeedModalOpen) return null;

  // ==========================================
  // 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
  // TODO (Backend Phase): Replace this Zustand mock logic with incoming/outgoing WebSockets from the ZeroClaw Rust server.
  // Expected Payload: { type: 'seed.inject', title: string, audience: string, context: string }
  // ==========================================
  const handleExecute = useCallback(() => {
    setIsExecuting(true);
    // Send the seed injection command to the Rust server
    sendCommand('seed.inject', {
      type: 'injectSeed',
      title: title || 'Unnamed Scenario',
      audience: audience || 'General',
      context: context || 'No additional context provided.',
    });
    // Clean up local form state (modal will be closed by seedApplied event)
    setTimeout(() => {
      setTitle('');
      setAudience('');
      setContext('');
      setIsExecuting(false);
    }, 300);
  }, [title, audience, context]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeSeedModal();
  }, [closeSeedModal]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-[600px] max-w-[calc(100vw-2rem)] bg-zinc-950 border border-emerald-500/50 rounded-xl shadow-[0_0_60px_rgba(16,185,129,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
        <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent blur-sm" />

        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          {['01101000 01100101', '00100000 01110111', '01101111 01110010', '01101100 01100100', '00100000 01110011', '01110100 01100001'].map((bin, i) => (
            <div
              key={i}
              className="absolute text-emerald-900/20 font-mono text-[10px] whitespace-nowrap"
              style={{ top: `${15 + i * 14}%`, left: `${20 + i * 10}%`, transform: 'rotate(-2deg)' }}
            >
              {bin}
            </div>
          ))}
        </div>

        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-emerald-400 text-lg tracking-widest font-bold uppercase">
                  Initialize New Scenario Seed
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-600 tracking-wide">
                SYS::OVERRIDE - ALL ACTIVE AGENTS WILL BE RESET
              </p>
            </div>
            <button
              onClick={closeSeedModal}
              className="w-7 h-7 rounded flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all duration-150 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                Scenario Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Post-AGI Consumer Economy v4.2"
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 text-emerald-400 placeholder:text-zinc-700 font-mono text-sm p-2.5 rounded outline-none transition-colors duration-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                Target Audience
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 text-emerald-400 font-mono text-sm p-2.5 rounded outline-none transition-colors duration-200 cursor-pointer"
              >
                <option value="" className="text-zinc-600 bg-zinc-900">Select target demographic...</option>
                {TARGET_AUDIENCES.map((a) => (
                  <option key={a} value={a} className="bg-zinc-900 text-emerald-400">{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                Context Variables
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={`> Enter market scenario, product concept, or crisis event...\n> e.g., "Global bandwidth shortage triggers local mesh network adoption..."`}
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 text-zinc-300 placeholder:text-zinc-700 font-mono text-xs p-3 rounded outline-none resize-none transition-colors duration-200 leading-relaxed"
              />
            </div>

            <div className="flex items-start gap-2 bg-amber-900/10 border border-amber-900/30 rounded p-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-mono text-amber-600 leading-relaxed">
                WARNING: Executing this directive will reset the tick counter to 0, purge all message history, and reinitialize all agent reasoning chains.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={closeSeedModal}
              className="px-4 py-2 text-xs font-mono font-bold text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 rounded transition-all duration-200 uppercase tracking-wide"
            >
              Cancel
            </button>

            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-xs font-mono font-bold uppercase tracking-widest transition-all duration-200',
                isExecuting
                  ? 'bg-emerald-800 text-emerald-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] active:scale-[0.98]'
              )}
            >
              {isExecuting ? (
                <>
                  <span className="w-3 h-3 rounded-full border border-emerald-400 border-t-transparent animate-spin" />
                  <span>INJECTING...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Execute Override</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
