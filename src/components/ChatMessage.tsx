import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Stethoscope, ThumbsUp, ThumbsDown, Volume2, VolumeX } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';
import { AppointmentConfirmation } from './AppointmentConfirmation';

export type Role = 'user' | 'model';

export interface Message {
  id: string;
  role: Role;
  text: string;
  audio?: string; // base64
  mimeType?: string;
  timestamp?: string;
}

interface ChatMessageProps {
  message: Message;
  isHighContrast?: boolean;
  onDateSelect?: (date: Date) => void;
  onSendMessage?: (msg: string) => void;
  onFeedback?: (messageId: string, rating: 'up' | 'down') => void;
  onTalkToPerson?: () => void;
}

export function ChatMessage({ message, isHighContrast, onDateSelect, onSendMessage, onFeedback, onTalkToPerson }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        window.speechSynthesis.cancel();
        let cleanText = (message.text || '')
          .replace(/\[SHOW_CALENDAR\]/g, '')
          .replace(/\[SHOW_CONFIRMATION\|[^\]]+\]/g, 'Your appointment with ABC Hospital has been logged and confirmed.')
          .replace(/\*\*([^*]+)\*\*/g, '$1') // remove markdown bold marks
          .trim();
        
        if (!cleanText) return;
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    } else {
      alert('Your browser does not support Text-to-Speech audio reader.');
    }
  };
  
  let displayText = message.text || '';
  
  const showCalendar = displayText.includes('[SHOW_CALENDAR]');
  if (showCalendar) {
    displayText = displayText.replace('[SHOW_CALENDAR]', '').trim();
  }

  let confirmationData: null | { doctor: string, date: string, time: string, department: string, patientName: string, email: string, phone: string } = null;
  const confirmMatch = displayText.match(/\[SHOW_CONFIRMATION\|([^\]]+)\]/);
  if (confirmMatch) {
    const parts = confirmMatch[1].split('|').map(p => p.trim());
    if (parts.length >= 4) {
      confirmationData = {
        doctor: parts[0] || '',
        date: parts[1] || '',
        time: parts[2] || '',
        department: parts[3] || '',
        patientName: parts[4] || '',
        email: parts[5] || '',
        phone: parts[6] || '',
      };
      displayText = displayText.replace(confirmMatch[0], '').trim();
    }
  }

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
        <div className="flex-shrink-0">
          {isUser ? (
            <div className={`${isHighContrast ? 'bg-white text-black border-2 border-white' : 'bg-red-700 text-white'} rounded-full p-2`}>
              <User size={18} />
            </div>
          ) : (
            <div className={`${isHighContrast ? 'bg-black text-white border-2 border-white' : 'bg-red-100 border-red-200 text-red-800'} rounded-full p-2 border`}>
              <Stethoscope size={18} />
            </div>
          )}
        </div>
        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
          <div 
            className={`px-4 py-3 rounded-2xl shadow-sm
              ${isUser 
                ? (isHighContrast ? 'bg-white text-black border-2 border-white rounded-br-sm' : 'bg-red-700 text-white rounded-br-sm') 
                : (isHighContrast ? 'bg-black border-2 border-white text-white rounded-bl-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm')
              }
            `}
          >
            {message.audio && (
              <div className="mb-2">
                <audio controls src={`data:${message.mimeType};base64,${message.audio}`} className="max-w-[200px] h-8" />
              </div>
            )}
            {isUser ? (
              displayText && <p className="whitespace-pre-wrap text-sm sm:text-base md:text-lg font-medium">{displayText}</p>
            ) : (
              <div className={`prose prose-base max-w-none text-sm sm:text-base md:text-lg ${isHighContrast ? 'prose-invert text-white' : 'prose-red text-gray-800'}`}>
                <Markdown remarkPlugins={[remarkGfm]}>
                  {displayText}
                </Markdown>
              </div>
            )}
            {showCalendar && !isUser && (
              <div className={`mt-4 rounded-xl border p-2 flex justify-center bg-white ${isHighContrast ? 'text-black' : ''}`}>
                <DayPicker
                  mode="single"
                  onSelect={(date) => {
                    if (date && onDateSelect) {
                      onDateSelect(date);
                    }
                  }}
                  disabled={[{ before: new Date() }]}
                  className="!m-0 text-sm"
                  classNames={{
                    selected: `bg-[#008080] text-white hover:bg-[#006666] focus:bg-[#008080]`,
                  }}
                />
              </div>
            )}
            {confirmationData && !isUser && (
              <AppointmentConfirmation 
                doctor={confirmationData.doctor}
                date={confirmationData.date}
                time={confirmationData.time}
                department={confirmationData.department}
                patientName={confirmationData.patientName}
                email={confirmationData.email}
                phone={confirmationData.phone}
                isHighContrast={isHighContrast}
                onCancel={() => {
                  if (onSendMessage) {
                    onSendMessage(`I want to cancel the appointment with ${confirmationData?.doctor} on ${confirmationData?.date} at ${confirmationData?.time}.`);
                  }
                }}
                onReschedule={() => {
                  if (onSendMessage) {
                    onSendMessage(`I want to reschedule the appointment with ${confirmationData?.doctor} on ${confirmationData?.date} at ${confirmationData?.time}.`);
                  }
                }}
              />
            )}
            {!isUser && (
              <div className="mt-3 pt-2 border-t border-dashed border-gray-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className={`text-[10px] font-medium ${isHighContrast ? 'text-gray-300' : 'text-gray-400'}`}>
                    Was this answer helpful?
                  </span>
                  {onTalkToPerson && (
                    <button
                      onClick={onTalkToPerson}
                      className={`text-[10px] font-bold hover:underline transition-all cursor-pointer flex items-center gap-1 ${
                        isHighContrast ? 'text-yellow-300' : 'text-[#008080]'
                      }`}
                    >
                      Not satisfied? Talk to a Live Person
                    </button>
                  )}
                </div>
                {feedback === 'down' && onTalkToPerson && (
                  <div className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 animate-fadeIn ${
                    isHighContrast ? 'bg-zinc-950 border-white text-white' : 'bg-red-50/50 border-red-100 text-red-800'
                  }`}>
                    <p className="font-semibold">Sorry about that! Let us connect you with our medical support staff immediately.</p>
                    <button
                      onClick={onTalkToPerson}
                      className={`self-start px-3 py-1.5 rounded-lg font-bold text-[10px] tracking-wider uppercase transition-all cursor-pointer border ${
                        isHighContrast
                          ? 'border-yellow-300 text-yellow-300 bg-black hover:bg-white hover:text-black'
                          : 'border-red-200 bg-red-600 text-white hover:bg-red-700 hover:shadow-sm'
                      }`}
                    >
                      WhatsApp Live Handoff (09075934287)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={`flex items-center ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
            {message.timestamp && (
              <span className={`text-[10px] px-1 font-bold ${isHighContrast ? 'text-yellow-300' : 'text-gray-400'}`}>
                {message.timestamp}
              </span>
            )}
            {!isUser && (
              <div className="flex items-center gap-2 ml-2">
                <button 
                  onClick={toggleSpeech}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-all uppercase border ${
                    isSpeaking 
                      ? (isHighContrast ? 'bg-red-950 border-red-500 text-red-300 animate-pulse' : 'bg-red-50 border-red-200 text-red-700 animate-pulse') 
                      : (isHighContrast ? 'bg-black border-white text-white hover:bg-white hover:text-black' : 'bg-[#008080]/5 border-[#008080]/15 text-[#008080] hover:bg-[#008080]/10')
                  }`}
                  title={isSpeaking ? "Stop Reading" : "Read response out loud"}
                  aria-label={isSpeaking ? "Stop reading response" : "Read response out loud"}
                >
                  {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>{isSpeaking ? 'Stop' : 'Read Out'}</span>
                </button>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      const next = feedback === 'up' ? null : 'up';
                      setFeedback(next);
                      if (next && onFeedback) onFeedback(message.id, 'up');
                    }}
                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${feedback === 'up' ? (isHighContrast ? 'text-yellow-300' : 'text-red-700') : (isHighContrast ? 'text-gray-400 hover:text-black' : 'text-gray-400')}`}
                    aria-label="Helpful"
                  >
                    <ThumbsUp size={14} className={feedback === 'up' ? 'fill-current' : ''} />
                  </button>
                  <button 
                    onClick={() => {
                      const next = feedback === 'down' ? null : 'down';
                      setFeedback(next);
                      if (next && onFeedback) onFeedback(message.id, 'down');
                    }}
                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${feedback === 'down' ? (isHighContrast ? 'text-yellow-300' : 'text-red-700') : (isHighContrast ? 'text-gray-400 hover:text-black' : 'text-gray-400')}`}
                    aria-label="Not helpful"
                  >
                    <ThumbsDown size={14} className={feedback === 'down' ? 'fill-current' : ''} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
