import React, { useState } from 'react';
import { ArrowRight, Brain, Globe, Network, ShieldCheck, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onContinue: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onContinue }) => {
  const [input, setInput] = useState('');

  const steps = [
    { num: '01', title: 'Structure The Claim', desc: 'Convert a loose question into a normalized investigation target.' },
    { num: '02', title: 'Search The Web', desc: 'Pull candidate sources across trusted domains and public pages.' },
    { num: '03', title: 'Parse Evidence', desc: 'Extract readable content from visited pages in real time.' },
    { num: '04', title: 'Judge Each Source', desc: 'Label support, contradiction, or neutral evidence with confidence.' },
    { num: '05', title: 'Return A Verdict', desc: 'Summarize the outcome with a transparent graph and evidence trail.' },
  ];

  const examples = [
    { label: 'Markets', text: "Has Tesla's automotive gross margin declined since 2022?" },
    { label: 'Policy', text: 'Did the EU approve the AI Act before the U.S. passed a comparable federal AI law?' },
    { label: 'Earnings', text: 'Did Microsoft report stronger Azure growth than analysts expected in its latest earnings?' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.16),_transparent_28%),linear-gradient(180deg,_#fffdf8_0%,_#f8fafc_100%)] text-slate-900 font-sans selection:bg-orange-100">
      <header className="sticky top-0 z-50 border-b border-orange-100/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-100 bg-white text-[#f59e0b] shadow-lg shadow-orange-100/70">
              <Brain size={22} />
            </div>
            <div>
              <span className="block text-lg font-black tracking-tight text-slate-900">One Mind</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Web Intelligence Engine</span>
            </div>
          </div>
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-orange-200 hover:text-[#f59e0b]"
          >
            Login
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24 pt-16 md:px-8">
        <section className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-10 animate-in slide-in-from-left-8 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#f59e0b] shadow-sm shadow-orange-100/80">
              <Sparkles size={14} />
              Truth Tracing For Live Claims
            </div>

            <div className="space-y-6">
              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tighter text-slate-900 md:text-7xl">
                Ask one question.
                <br />
                Watch the web get cross-examined.
              </h1>
              <p className="max-w-2xl text-lg font-medium leading-8 text-slate-500">
                One Mind turns open-ended claims into structured investigations, visits live sources, scores evidence,
                and returns a transparent verdict with a browsable reasoning trail.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-slate-200/40">
                <Globe className="mb-3 text-[#f59e0b]" size={20} />
                <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-800">Live Retrieval</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Real websites, not canned examples, drive the result.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-slate-200/40">
                <Network className="mb-3 text-[#f59e0b]" size={20} />
                <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-800">Evidence Graph</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">See which sources were visited, parsed, and judged.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-slate-200/40">
                <ShieldCheck className="mb-3 text-[#f59e0b]" size={20} />
                <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-800">Traceable Verdict</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Support, contradiction, and uncertainty stay visible.</p>
              </div>
            </div>

            <div className="space-y-5 rounded-[32px] border border-orange-100/70 bg-white/85 p-8 shadow-xl shadow-slate-200/50">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                Investigation Flow
              </div>
              {steps.map((step) => (
                <div key={step.num} className="grid grid-cols-[56px_1fr] gap-4">
                  <span className="text-2xl font-black italic text-slate-200">{step.num}</span>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-800">{step.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-in slide-in-from-right-8 duration-700">
            <div className="overflow-hidden rounded-[32px] border border-orange-100/70 bg-white/90 shadow-[0_30px_80px_rgba(148,163,184,0.18)]">
              <div className="border-b border-orange-100/70 bg-[linear-gradient(135deg,_rgba(251,146,60,0.10),_rgba(255,255,255,0.92))] p-8">
                <h2 className="text-3xl font-black tracking-tight text-slate-900">Trace a question across the web</h2>
                <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">
                  Follow how One Mind searches sources, maps evidence, and turns scattered signals into a clear verdict.
                </p>
              </div>

              <div className="p-8">
                <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-[linear-gradient(180deg,_rgba(248,250,252,0.95),_rgba(255,255,255,1))] shadow-inner shadow-slate-100/70">
                  <div className="relative h-[280px] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.10),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.8),_rgba(248,250,252,0.95))]">
                    <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                    <div className="absolute left-[14%] top-[18%] flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-100 bg-white text-[11px] font-black text-[#f59e0b] shadow-lg shadow-orange-100/60">
                      Q
                    </div>
                    <div className="absolute left-[38%] top-[14%] flex h-14 w-14 items-center justify-center rounded-[18px] border border-sky-100 bg-white text-[11px] font-black text-sky-600 shadow-lg shadow-sky-100/60">
                      WEB
                    </div>
                    <div className="absolute right-[18%] top-[22%] flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-[11px] font-black text-indigo-600 shadow-lg shadow-indigo-100/60">
                      AI
                    </div>
                    <div className="absolute left-[28%] bottom-[22%] flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-[10px] font-black text-emerald-600 shadow-lg shadow-emerald-100/60">
                      +
                    </div>
                    <div className="absolute right-[24%] bottom-[18%] flex h-16 w-16 items-center justify-center rounded-[22px] border border-slate-200 bg-white text-[11px] font-black text-slate-700 shadow-xl shadow-slate-200/60">
                      VERDICT
                    </div>

                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M16 24 C26 22, 30 20, 39 21" fill="none" stroke="rgba(245,158,11,0.55)" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M44 21 C53 22, 60 24, 70 28" fill="none" stroke="rgba(59,130,246,0.45)" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M43 24 C42 36, 38 46, 31 62" fill="none" stroke="rgba(14,165,233,0.35)" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M70 31 C69 45, 69 56, 74 70" fill="none" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M34 66 C44 69, 54 72, 69 73" fill="none" stroke="rgba(15,23,42,0.18)" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2.5 3" />
                    </svg>

                    <div className="absolute left-[9%] top-[54%] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 shadow-md shadow-slate-200/50">
                      Claim
                    </div>
                    <div className="absolute left-[44%] top-[43%] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 shadow-md shadow-slate-200/50">
                      Sources
                    </div>
                    <div className="absolute right-[11%] bottom-[10%] rounded-full bg-orange-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#f59e0b] shadow-md shadow-orange-100/50">
                      Live Trace
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    onClick={onContinue}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition-all hover:border-orange-200 hover:text-[#f59e0b]"
                  >
                    Explore One Mind
                    <ArrowRight size={16} />
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Good prompts</p>
                  <div className="mt-3 space-y-2">
                    {examples.map((example) => (
                      <button
                        key={example.text}
                        onClick={() => setInput(example.text)}
                        className="block w-full rounded-2xl border border-white bg-white px-4 py-3 text-left text-sm font-semibold leading-6 text-slate-600 transition-all hover:border-orange-100 hover:text-slate-900"
                      >
                        {example.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-orange-100/70 bg-amber-50/60 px-8 py-4">
                <p className="text-[11px] font-bold leading-5 text-amber-800">
                  Results depend on live website access and model availability. Keep backend secrets on the API host only.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
