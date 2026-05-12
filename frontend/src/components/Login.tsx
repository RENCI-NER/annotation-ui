import React, { useState } from 'react';

interface Props {
  onLogin: (annotator: string) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');

  const buildName = () => {
    const first = firstName.trim().toLowerCase();
    const last = lastName.trim().toLowerCase();
    const mid = middleInitial.trim().toLowerCase();
    if (mid) return `${first}.${mid}.${last}`;
    return `${first}.${last}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const first = firstName.trim().toLowerCase();
    const last = lastName.trim().toLowerCase();
    if (!first || !last || first.length < 2 || last.length < 2) return;
    onLogin(buildName());
  };

  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
        max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-teal-400 via-cyan-500 to-teal-400" />

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4
              bg-gradient-to-br from-teal-400 to-cyan-600 rounded-2xl
              shadow-lg shadow-teal-900/40">
              <span className="text-white text-2xl font-bold">R</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Annotation <span className="text-teal-500">Portal</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Biomedical Knowledge Graph Annotation
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full px-4 py-3
                    border-2 border-slate-200 dark:border-slate-600
                    bg-white dark:bg-slate-700
                    text-slate-900 dark:text-white
                    rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                    placeholder:text-slate-400 dark:placeholder:text-slate-500
                    transition-all duration-200"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  M.I.
                </label>
                <input
                  type="text"
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value.slice(0, 1))}
                  placeholder="—"
                  maxLength={1}
                  className="w-14 px-3 py-3 text-center
                    border-2 border-slate-200 dark:border-slate-600
                    bg-white dark:bg-slate-700
                    text-slate-900 dark:text-white
                    rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                    placeholder:text-slate-400 dark:placeholder:text-slate-500
                    transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-4 py-3
                    border-2 border-slate-200 dark:border-slate-600
                    bg-white dark:bg-slate-700
                    text-slate-900 dark:text-white
                    rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                    placeholder:text-slate-400 dark:placeholder:text-slate-500
                    transition-all duration-200"
                />
              </div>
            </div>

            {isValid && (
              <div className="text-xs text-slate-400 text-center">
                You will be logged in as <span className="font-semibold text-teal-600 dark:text-teal-400">{buildName()}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid}
              className="w-full py-3.5
                bg-gradient-to-r from-teal-500 to-cyan-600
                hover:from-teal-600 hover:to-cyan-700
                disabled:from-slate-300 disabled:to-slate-300
                dark:disabled:from-slate-600 dark:disabled:to-slate-600
                text-white font-semibold rounded-xl
                shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40
                disabled:shadow-none
                transition-all duration-200
                disabled:cursor-not-allowed"
            >
              {isValid ? 'Start Annotating' : 'Enter Your Name'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Need help?</span>
              <a href="mailto:bizon@renci.org"
                className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors">
                Contact Admin
              </a>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
              <a href="https://renci.org" target="_blank" rel="noopener noreferrer"
                className="hover:text-teal-500 transition-colors">RENCI</a>
              <span>·</span>
              <span>v2.0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-slate-500">
          Funded by NIH LitCoin (#75N95023C00032)
        </p>
      </div>
    </div>
  );
};
