/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { Eye, PhoneCall, AlertTriangle, Activity } from 'lucide-react';

export default function App() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isHighContrast ? 'bg-black text-white' : 'bg-slate-50'}`}>
      <header className={`${isHighContrast ? 'bg-black border-white text-white' : 'bg-white border-gray-100'} border-b py-3 px-6 shadow-sm z-10 sticky top-0 transition-colors`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Custom rounded teal square box with heartbeat/pulse icon */}
            <div className={`rounded-xl p-2.5 flex items-center justify-center ${isHighContrast ? 'bg-white text-black' : 'bg-[#008080] text-white shadow-sm'}`}>
              <Activity size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className={`text-base sm:text-lg font-bold leading-tight ${isHighContrast ? 'text-white' : 'text-gray-800'}`}>
                ABC Hospital Assistant
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isHighContrast ? 'bg-yellow-300' : 'bg-[#00a884]'}`}></span>
                <span className={`text-xs font-semibold ${isHighContrast ? 'text-yellow-300' : 'text-[#00a884]'}`}>
                  Human staff available
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold ${isHighContrast ? 'text-yellow-300' : 'text-[#006699]'}`}>
              <PhoneCall size={16} />
              <span className="hidden md:inline">Emergency:</span>
              <span>0800-ABC-HOSP / 112</span>
            </div>
            
            <button
              onClick={() => setIsHighContrast(!isHighContrast)}
              className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-full text-[11px] sm:text-xs font-semibold border transition-colors ${
                isHighContrast 
                  ? 'border-white text-white hover:bg-white hover:text-black' 
                  : 'border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
              aria-label="Toggle High Contrast Mode"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">High Contrast</span>
            </button>
          </div>
        </div>
      </header>

      {/* Warning Alert Banner */}
      <div className={`border-b py-2.5 px-4 text-center ${
        isHighContrast 
          ? 'bg-black border-red-500 text-red-400' 
          : 'bg-[#fff5f5] border-red-100 text-red-700'
      } transition-colors`}>
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-xs sm:text-sm font-medium">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>This assistant does not diagnose. For emergencies, call 0800-ABC-HOSP / 112 or visit the nearest ER immediately.</span>
        </div>
      </div>
      
      <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-6xl h-[calc(100vh-140px)] min-h-[550px]">
          <ChatInterface isHighContrast={isHighContrast} />
        </div>
      </main>
    </div>
  );
}
