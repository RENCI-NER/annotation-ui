// import React from 'react';
// import { Progress, Stats } from '../types';

// interface Props {
//   progress: Progress;
//   stats: Stats;
// }

// const ACHIEVEMENTS: Record<string, { icon: string; label: string; color: string }> = {
//   first_10: { icon: '🎯', label: 'First 10', color: 'bg-green-100 text-green-700' },
//   century: { icon: '💯', label: 'Century Club', color: 'bg-blue-100 text-blue-700' },
//   marathon: { icon: '🏃', label: 'Marathon', color: 'bg-purple-100 text-purple-700' },
//   streak_3: { icon: '🔥', label: '3 Day Streak', color: 'bg-orange-100 text-orange-700' },
//   streak_7: { icon: '⭐', label: '7 Day Streak', color: 'bg-yellow-100 text-yellow-700' }
// };

// export const ProgressBar: React.FC<Props> = ({ progress, stats }) => {
//   return (
//     <div className="bg-white rounded-xl shadow-lg overflow-hidden">
//       {/* Stats Cards */}
//       <div className="grid grid-cols-4 gap-px bg-gray-200">
//         <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4">
//           <div className="flex items-center gap-3">
//             <div className="text-3xl">🔥</div>
//             <div>
//               <div className="text-2xl font-bold text-blue-600">{stats.streak_days}</div>
//               <div className="text-xs text-blue-600 font-medium">Day Streak</div>
//             </div>
//           </div>
//         </div>
        
//         <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4">
//           <div className="flex items-center gap-3">
//             <div className="text-3xl">⭐</div>
//             <div>
//               <div className="text-2xl font-bold text-purple-600">{stats.total_annotations}</div>
//               <div className="text-xs text-purple-600 font-medium">Total Annotations</div>
//             </div>
//           </div>
//         </div>
        
//         <div className="bg-gradient-to-br from-green-50 to-green-100 p-4">
//           <div className="flex items-center gap-3">
//             <div className="text-3xl">✅</div>
//             <div>
//               <div className="text-2xl font-bold text-green-600">{stats.annotations_today}</div>
//               <div className="text-xs text-green-600 font-medium">Today</div>
//             </div>
//           </div>
//         </div>
        
//         <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4">
//           <div className="flex items-center gap-3">
//             <div className="text-3xl">📊</div>
//             <div>
//               <div className="text-2xl font-bold text-orange-600">
//                 {progress.completion_percentage.toFixed(0)}%
//               </div>
//               <div className="text-xs text-orange-600 font-medium">Complete</div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Progress Bar */}
//       <div className="p-4">
//         <div className="mb-2 flex items-center justify-between text-sm">
//           <span className="font-medium text-gray-700">Overall Progress</span>
//           <span className="text-gray-500">
//             {progress.annotated_triples} / {progress.total_triples} triples
//           </span>
//         </div>
//         <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
//           <div
//             className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 rounded-full"
//             style={{ width: `${progress.completion_percentage}%` }}
//           >
//             <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
//           </div>
//         </div>
        
//         <div className="mt-2 flex gap-4 text-xs text-gray-500">
//           <span>📄 {progress.annotated_articles}/{progress.total_articles} articles</span>
//           <span>⏭️ {progress.skipped_triples} skipped</span>
//           <span>🚩 {progress.flagged_triples} flagged</span>
//         </div>
//       </div>

//       {/* Achievements */}
//       {stats.achievements.length > 0 && (
//         <div className="px-4 pb-4">
//           <div className="text-xs font-semibold text-gray-500 mb-2">🏆 Achievements</div>
//           <div className="flex gap-2 flex-wrap">
//             {stats.achievements.map(achievement => {
//               const info = ACHIEVEMENTS[achievement];
//               if (!info) return null;
//               return (
//                 <div
//                   key={achievement}
//                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${info.color}`}
//                 >
//                   <span>{info.icon}</span>
//                   <span>{info.label}</span>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// frontend/src/components/ProgressBar.tsx
import React from 'react';
import { Progress, Stats } from '../types';

interface Props {
  progress: Progress;
  stats: Stats;
}

const ACHIEVEMENTS: Record<string, { icon: string; label: string }> = {
  first_10: { icon: '🎯', label: 'First 10' },
  century: { icon: '💯', label: 'Century Club' },
  marathon: { icon: '🏃', label: 'Marathon' },
  streak_3: { icon: '🔥', label: '3 Day Streak' },
  streak_7: { icon: '🔥🔥', label: '7 Day Streak' }
};

export const ProgressBar: React.FC<Props> = ({ progress, stats }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <span className="font-bold text-lg">{stats.streak_days}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <span className="font-bold text-lg">{stats.total_annotations}</span>
          </div>
          <div className="text-sm text-gray-600">
            Today: {stats.annotations_today}
          </div>
        </div>

        <div className="flex gap-2">
          {stats.achievements.map(achievement => {
            const info = ACHIEVEMENTS[achievement];
            if (!info) return null;
            return (
              <div
                key={achievement}
                className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-sm"
                title={info.label}
              >
                <span>{info.icon}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Overall Progress</span>
          <span>{progress.completion_percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${progress.completion_percentage}%` }}
          />
        </div>
      </div>

      {/* Detailed Status Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center p-2 bg-green-50 rounded">
          <div className="text-xs text-gray-600">Annotated</div>
          <div className="text-lg font-bold text-green-600">
            {progress.annotated_triples}
          </div>
        </div>
        <div className="text-center p-2 bg-yellow-50 rounded">
          <div className="text-xs text-gray-600">Skipped</div>
          <div className="text-lg font-bold text-yellow-600">
            {progress.skipped_triples}
          </div>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded">
          <div className="text-xs text-gray-600">Flagged</div>
          <div className="text-lg font-bold text-orange-600">
            {progress.flagged_triples}
          </div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600">Remaining</div>
          <div className="text-lg font-bold text-gray-600">
            {progress.unannotated_triples}
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-600">
        <div>
          <span className="font-medium">{progress.annotated_articles}</span>
          <span className="text-gray-400"> / {progress.total_articles} articles</span>
        </div>
        <div className="text-gray-400">|</div>
        <div>
          <span className="font-medium">{progress.total_triples}</span>
          <span className="text-gray-400"> total triples</span>
        </div>
      </div>
    </div>
  );
};