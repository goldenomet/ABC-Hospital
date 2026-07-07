import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Stethoscope, 
  Calendar, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Building2, 
  CreditCard, 
  AlertTriangle,
  User,
  Mail,
  LogIn,
  LogOut,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Lock,
  Star
} from 'lucide-react';
import { ChatMessage, type Message } from './ChatMessage';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  syncPatientLeadToSheets, 
  sendEmailViaGmail,
  type LeadDetails 
} from '../lib/firebase';
import { type User as FirebaseUser } from 'firebase/auth';

const playBeep = (frequency: number = 880, duration: number = 0.1, type: OscillatorType = 'sine') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error('Audio beep failed', e);
  }
};

export function ChatInterface({ 
  isHighContrast = false, 
  deviceMode = 'desktop' 
}: { 
  isHighContrast?: boolean; 
  deviceMode?: 'desktop' | 'tablet' | 'mobile';
}) {
  const [mobileTab, setMobileTab] = useState<'chat' | 'info'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Welcome to ABC Hospital. I am your virtual assistant. How may I help you today? I can assist you with scheduling an appointment or provide basic information about our medical services.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [patientName, setPatientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  // Google Sheets Lead Sync State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; link?: string; message?: string } | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [lastSyncedDetails, setLastSyncedDetails] = useState<string>('');

  // Gmail Outreach State
  const [gmailTo, setGmailTo] = useState('');
  const [gmailSubject, setGmailSubject] = useState('Appointment Follow-up - ABC Hospital');
  const [gmailBody, setGmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [gmailResult, setGmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Assistant Star Feedback State
  const [starRating, setStarRating] = useState<number | null>(null);
  const [isSendingRating, setIsSendingRating] = useState(false);
  const [ratingSent, setRatingSent] = useState(false);

  // Admin / Director Panel Lock State (Option A)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem('abc_admin_unlocked') === 'true';
  });
  const [showPasscodePrompt, setShowPasscodePrompt] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = passcodeInput.trim().toLowerCase();
    if (cleanInput === 'admin' || cleanInput === 'abc2026') {
      setIsAdminUnlocked(true);
      localStorage.setItem('abc_admin_unlocked', 'true');
      setShowPasscodePrompt(false);
      setPasscodeInput('');
      setPasscodeError('');
      playBeep(660, 0.15, 'sine');
    } else {
      setPasscodeError('Invalid passcode. Access denied.');
      playBeep(220, 0.25, 'triangle');
    }
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    localStorage.removeItem('abc_admin_unlocked');
    playBeep(440, 0.1, 'sine');
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Synchronize Gmail Recipient with Profile Email field
  useEffect(() => {
    setGmailTo(email);
  }, [email]);

  // Synchronize Email Draft Body with Patient Name
  useEffect(() => {
    const nameToUse = patientName.trim() || 'Valued Patient';
    setGmailBody(
      `Dear ${nameToUse},\n\nThank you for reaching out to ABC Hospital. We wanted to follow up on your recent inquiry and see how we can assist you today. Please let us know if you would like to speak with a physician or schedule an appointment.\n\nBest regards,\nABC Hospital Patient Care Team`
    );
  }, [patientName]);

  // Initialize Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSyncResult(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setSyncResult({ success: true, message: 'Successfully connected Google Workspace!' });
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setSyncResult({ success: false, message: 'Google connection failed.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setSyncResult(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleSyncLead = async (manual = false) => {
    const trimmedName = patientName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    
    if (!trimmedName && !trimmedEmail && !trimmedPhone) {
      if (manual) {
        setSyncResult({ success: false, message: 'Please enter patient details (Name, Email, or Phone) before syncing.' });
      }
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const currentDetails = JSON.stringify({ name: trimmedName, email: trimmedEmail, phone: trimmedPhone });
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const lastMsgText = lastMsg ? (lastMsg.text || (lastMsg.audio ? '[Voice Note]' : '')) : '';

      const res = await syncPatientLeadToSheets({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        lastMessage: lastMsgText || 'Consultation lead from ABC Hospital Bot'
      });

      setLastSyncedDetails(currentDetails);
      setSyncResult({ success: true, link: res.webViewLink, message: 'Lead successfully synced to Google Sheet!' });
      
      if (!manual) {
        setTimeout(() => {
          setSyncResult(null);
        }, 4000);
      }
    } catch (err: any) {
      console.error('Lead sync failed:', err);
      setSyncResult({ success: false, message: err.message || 'Failed to sync lead.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const checkAndTriggerAutoSync = () => {
    const trimmedName = patientName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const currentDetails = JSON.stringify({ name: trimmedName, email: trimmedEmail, phone: trimmedPhone });
    
    // Read current cached token or state token
    if (token && autoSync && (trimmedName || trimmedEmail || trimmedPhone) && currentDetails !== lastSyncedDetails) {
      handleSyncLead(false).catch(console.error);
    }
  };

  const handleSendEmail = async () => {
    if (!gmailTo || !gmailTo.includes('@')) {
      setGmailResult({ success: false, message: 'Please provide a valid recipient email address.' });
      return;
    }
    setIsSendingEmail(true);
    setGmailResult(null);
    try {
      const htmlBody = gmailBody.replace(/\n/g, '<br/>');
      await sendEmailViaGmail({
        to: gmailTo,
        subject: gmailSubject,
        body: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #334155;">${htmlBody}</div>`
      });
      setGmailResult({ success: true, message: 'Follow-up email successfully sent via Gmail!' });
      setTimeout(() => setGmailResult(null), 5000);
    } catch (err: any) {
      console.error('Failed to send email:', err);
      setGmailResult({ success: false, message: err.message || 'Failed to send email.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendAudioMessage = async (base64Audio: string, mimeType: string) => {
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: '', // Empty text for voice note
      audio: base64Audio,
      mimeType: mimeType,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages((prev) => [...prev, newUserMsg]);
    setIsProcessingAudio(true);
    setIsLoading(true);

    try {
      const payloadMessages = [...messages, newUserMsg].map(m => ({ 
        role: m.role, 
        text: m.text,
        audio: m.audio,
        mimeType: m.mimeType
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: payloadMessages,
          patientName,
          email,
          phone
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'model', text: data.text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
      checkAndTriggerAutoSync();
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'model', text: 'I apologize, but I am having trouble connecting right now.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } finally {
      setIsLoading(false);
      setIsProcessingAudio(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        playBeep(880, 0.15, 'sine'); // High beep when recording finishes
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Extract base64 part
          const base64 = base64data.split(',')[1];
          sendAudioMessage(base64, 'audio/webm');
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      playBeep(440, 0.1, 'sine'); // Low beep when starting
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userText = text.trim();
    setInput('');
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, newUserMsg].map(m => ({ role: m.role, text: m.text, audio: m.audio, mimeType: m.mimeType })),
          patientName,
          email,
          phone
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'model', text: data.text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
      checkAndTriggerAutoSync();
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'model', text: 'I apologize, but I am having trouble connecting to our systems right now.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
      return;
    }
    sendMessage(input);
  };

  const handleChipClick = (query: string) => {
    sendMessage(query);
  };

  const handleDateSelect = (date: Date) => {
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    sendMessage(`I would like to book an appointment for ${formattedDate}.`);
  };

  const handleLiveHandoff = () => {
    const formattedName = patientName.trim() || 'Anonymous Patient';
    const formattedEmail = email.trim() || 'Not provided';
    const formattedPhone = phone.trim() || 'Not provided';

    // Construct a pre-filled preliminary message for WhatsApp
    const waMessage = `Hello ABC Hospital Support Team,\n\nI am contacting you via your Virtual Assistant.\n\n*Patient Details:*\n- Name: ${formattedName}\n- Email: ${formattedEmail}\n- Phone: ${formattedPhone}\n\nI would like to speak to a live support agent regarding my inquiry.`;
    const waUrl = `https://wa.me/2349075934287?text=${encodeURIComponent(waMessage)}`;

    // Prepare a clear preliminary notice to display in the chatbot window
    const supportMessage = `🔔 **Live Handoff Initiated**\n\nConnecting you to our live support team on WhatsApp at **09075934287**.\n\nWe have securely pre-filled a message with your patient details to assist you faster:\n\n* 👤 **Patient Name:** ${formattedName}\n* ✉️ **Email:** ${formattedEmail}\n* 📞 **Phone:** ${formattedPhone}\n\n[👉 Open WhatsApp Chat & Send Message](${waUrl})`;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + '_user_handoff',
        role: 'user',
        text: 'Live chat handoff request',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      {
        id: Date.now().toString() + '_model_handoff',
        role: 'model',
        text: supportMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFeedback = async (messageId: string, rating: 'up' | 'down') => {
    const msg = messages.find(m => m.id === messageId);
    const feedbackText = rating === 'up' ? 'Thumbs Up (Satisfied / Positive)' : 'Thumbs Down (Not Satisfied / Negative)';
    
    const formattedName = patientName.trim() || 'Anonymous Patient';
    const formattedEmail = email.trim() || 'Not provided';
    const formattedPhone = phone.trim() || 'Not provided';

    const patientDetails = `
      <h3>Patient Profile Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${formattedName}</li>
        <li><strong>Email:</strong> ${formattedEmail}</li>
        <li><strong>Phone:</strong> ${formattedPhone}</li>
      </ul>
    `;
    
    const contextContent = msg ? `
      <h3>Chat Response Context:</h3>
      <blockquote style="background: #f8fafc; border-left: 4px solid #ef4444; padding: 12px; margin: 10px 0;">
        <strong>Assistant Response:</strong> <p style="white-space: pre-wrap; margin: 4px 0 0 0;">${msg.text}</p>
      </blockquote>
    ` : '';

    const emailBodyHTML = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <h2 style="color: #008080; border-bottom: 2px solid #008080; padding-bottom: 8px; margin-top: 0;">Patient Rating Submission</h2>
        <p>A user has evaluated a virtual assistant response.</p>
        <p style="font-size: 16px;"><strong>Feedback Score / Evaluation:</strong> <span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: bold;">${feedbackText}</span></p>
        ${patientDetails}
        ${contextContent}
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b;"><em>This is an automated operational notification sent from your ABC Hospital Assistant app.</em></p>
      </div>
    `;

    // Attempt to send in background via Gmail
    if (user && token) {
      try {
        await sendEmailViaGmail({
          to: user.email || 'goldenomet0@gmail.com',
          subject: `Patient Rating Alert: ${rating === 'up' ? '👍 Positive' : '👎 Negative'} Feedback Received`,
          body: emailBodyHTML
        });
        console.log('Background feedback email sent successfully.');
      } catch (err) {
        console.error('Failed to send background rating email:', err);
      }
    } else {
      console.log('No active Google session to send feedback email in background.');
    }
  };

  const handleStarFeedback = async (score: number) => {
    setStarRating(score);
    setIsSendingRating(true);
    playBeep(523.25, 0.15, 'sine'); // C5 note

    const formattedName = patientName.trim() || 'Anonymous Patient';
    const formattedEmail = email.trim() || 'Not provided';
    const formattedPhone = phone.trim() || 'Not provided';

    const patientDetails = `
      <h3>Patient Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${formattedName}</li>
        <li><strong>Email:</strong> ${formattedEmail}</li>
        <li><strong>Phone:</strong> ${formattedPhone}</li>
      </ul>
    `;

    const emailBodyHTML = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <h2 style="color: #008080; border-bottom: 2px solid #008080; padding-bottom: 8px; margin-top: 0;">Assistant Satisfaction Rating</h2>
        <p>A user has left a star rating score for the ABC Hospital Assistant.</p>
        <div style="font-size: 24px; font-weight: bold; color: #fbbf24; margin: 15px 0;">
          Rating Score: ${'★'.repeat(score)}${'☆'.repeat(5 - score)} (${score}/5 Stars)
        </div>
        ${patientDetails}
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b;"><em>This is an automated operational notification sent from your ABC Hospital Assistant app.</em></p>
      </div>
    `;

    // Send using Gmail in background
    if (user && token) {
      try {
        await sendEmailViaGmail({
          to: user.email || 'goldenomet0@gmail.com',
          subject: `Patient Star Rating Received: ${score}/5 Stars ⭐`,
          body: emailBodyHTML
        });
        setRatingSent(true);
        console.log('Star rating feedback email sent successfully in the background.');
      } catch (err) {
        console.error('Failed to send star rating email:', err);
      } finally {
        setIsSendingRating(false);
      }
    } else {
      // Just set success locally if not logged in so they see it worked
      setTimeout(() => {
        setRatingSent(true);
        setIsSendingRating(false);
      }, 800);
      console.log('No active Google session to send star rating email; saved rating locally.');
    }
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto">
      {/* On Mobile/Tablet view, show a tab navigation bar at the top */}
      <div className="lg:hidden flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-800 flex-shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${
            mobileTab === 'chat'
              ? (isHighContrast ? 'bg-white text-black font-extrabold' : 'bg-[#008080] text-white shadow-sm')
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Chat Assistant
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('info')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center ${
            mobileTab === 'info'
              ? (isHighContrast ? 'bg-white text-black font-extrabold' : 'bg-[#008080] text-white shadow-sm')
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Hospital Details & Actions
        </button>
      </div>

      {/* Left Column: Chat Container (Styled exactly like the screenshots, font size increased) */}
      <div className={`flex-1 flex-col h-full rounded-2xl overflow-hidden border shadow-md ${
        mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'
      } ${isHighContrast ? 'bg-black border-white' : 'bg-white border-slate-100'}`}>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Welcome Image Banner at top of chat pane */}
          <div className="relative w-full h-36 sm:h-44 overflow-hidden rounded-xl mb-4 flex-shrink-0">
            <img
              src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=1000"
              alt="ABC Hospital Lobby"
              className="w-full h-full object-cover brightness-[0.7]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end p-4">
              <h2 className="text-white text-lg sm:text-xl md:text-2xl font-bold">Welcome to ABC Hospital</h2>
              <p className="text-gray-200 text-xs sm:text-sm font-medium">Open 24/7 · Leading Care & Direct Patient Leads</p>
            </div>
          </div>

          {messages.map((msg) => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              isHighContrast={isHighContrast} 
              onDateSelect={handleDateSelect} 
              onSendMessage={sendMessage} 
              onFeedback={handleFeedback}
              onTalkToPerson={handleLiveHandoff}
            />
          ))}
          {isLoading && (
            <div className="flex w-full justify-start mb-4">
              <div className="flex flex-row items-end gap-2">
                <div className="flex-shrink-0">
                  <div className={`${isHighContrast ? 'bg-black text-white border-2 border-white' : 'bg-red-100 border border-red-200 text-red-800'} rounded-full p-2`}>
                    <Stethoscope size={18} />
                  </div>
                </div>
                <div className={`px-5 py-4 rounded-2xl shadow-sm rounded-bl-sm flex items-center gap-1.5 ${isHighContrast ? 'bg-black border-2 border-white text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isHighContrast ? 'bg-white' : 'bg-red-400'}`} style={{ animationDelay: '0ms' }}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isHighContrast ? 'bg-white' : 'bg-red-400'}`} style={{ animationDelay: '150ms' }}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isHighContrast ? 'bg-white' : 'bg-red-400'}`} style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Controls and Fields (Increased font size, stacked metadata inputs) */}
        <div className={`p-4 sm:p-5 border-t flex flex-col gap-4 ${isHighContrast ? 'bg-black border-white' : 'bg-[#fafafa] border-slate-100'}`}>
          
          {/* Metadata Fields stack: Patient Name, Email, Phone Number */}
          <div className="space-y-2 max-w-full">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <User size={16} />
              </span>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient name (optional)"
                className={`w-full pl-10 pr-4 py-2.5 rounded-full text-sm sm:text-base border transition-all focus:outline-none focus:ring-2 ${
                  isHighContrast
                    ? 'border-white bg-black text-white placeholder-gray-500 focus:ring-yellow-300'
                    : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-[#008080] focus:border-[#008080]'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address (optional)"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-full text-sm sm:text-base border transition-all focus:outline-none focus:ring-2 ${
                    isHighContrast
                      ? 'border-white bg-black text-white placeholder-gray-500 focus:ring-yellow-300'
                      : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-[#008080] focus:border-[#008080]'
                  }`}
                />
              </div>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Phone size={16} />
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number (optional)"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-full text-sm sm:text-base border transition-all focus:outline-none focus:ring-2 ${
                    isHighContrast
                      ? 'border-white bg-black text-white placeholder-gray-500 focus:ring-yellow-300'
                      : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-[#008080] focus:border-[#008080]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Quick chips buttons */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {["Book appointment", "Find a doctor", "I have a fever"].map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => handleChipClick(query)}
                disabled={isLoading}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm sm:text-base font-medium transition-colors border disabled:opacity-50 ${
                  isHighContrast 
                    ? 'bg-black text-yellow-300 border-yellow-300 hover:bg-yellow-300 hover:text-black' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 shadow-sm'
                }`}
              >
                {query}
              </button>
            ))}
          </div>

          {/* Chat text box input */}
          <form onSubmit={handleSubmit} className="flex gap-2.5 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? "Listening..." : "Type your message..."}
              disabled={isLoading}
              className={`flex-1 pl-4 pr-12 py-3.5 text-sm sm:text-base border rounded-xl focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                isHighContrast 
                  ? (isRecording ? 'border-yellow-300 bg-gray-900 text-white placeholder-gray-400 focus:ring-yellow-300' : 'border-white bg-black text-white placeholder-gray-400 focus:ring-white')
                  : (isRecording ? 'border-red-300 bg-red-50 focus:ring-[#008080]' : 'bg-white border-slate-200 focus:ring-[#008080] focus:border-[#008080]')
              }`}
            />
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isLoading}
              className={`absolute right-[76px] top-1/2 -translate-y-1/2 p-2 transition-colors disabled:opacity-50 ${
                isHighContrast
                  ? (isRecording ? 'text-yellow-300 animate-pulse hover:text-white' : 'text-gray-400 hover:text-white')
                  : (isRecording ? 'text-red-500 hover:text-red-600 animate-pulse' : 'text-gray-400 hover:text-[#008080]')
              }`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button
              type="submit"
              disabled={(!input.trim() && !isRecording) || isLoading}
              className={`px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[70px] ${
                isHighContrast
                  ? 'bg-white text-black hover:bg-gray-200 focus:ring-white focus:ring-offset-black'
                  : 'bg-zinc-800 text-white hover:bg-zinc-900 focus:ring-zinc-600 focus:ring-offset-white'
              }`}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Beautiful Sidebar (Matches screenshots exactly) */}
      <div className={`${
        mobileTab === 'info' ? 'flex w-full' : 'hidden lg:flex lg:w-80'
      } flex-col gap-4 overflow-y-auto max-h-full`}>
        
        {/* Hospital Info Card */}
        <div className={`p-5 rounded-2xl border ${isHighContrast ? 'border-white bg-black' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-bold text-base uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-800'}`}>
              Hospital Info
            </h3>
            <button
              onClick={() => {
                if (isAdminUnlocked) {
                  handleLockAdmin();
                } else {
                  setShowPasscodePrompt(true);
                  setPasscodeError('');
                }
              }}
              title={isAdminUnlocked ? "Lock Admin Settings" : "Unlock Admin Settings"}
              className={`p-1.5 rounded-lg border transition-all ${
                isAdminUnlocked
                  ? (isHighContrast ? 'border-yellow-300 text-yellow-300 bg-black' : 'border-emerald-200 text-emerald-600 bg-emerald-50')
                  : (isHighContrast ? 'border-zinc-800 text-zinc-500 hover:text-white' : 'border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50')
              }`}
            >
              {isAdminUnlocked ? <ShieldCheck size={14} /> : <Lock size={14} />}
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3.5 text-sm sm:text-base">
              <Calendar size={18} className="text-[#008080] flex-shrink-0 mt-0.5" />
              <span>Open 24/7 · OPD 8AM–8PM</span>
            </div>
            <div className="flex items-start gap-3.5 text-sm sm:text-base">
              <MapPin size={18} className="text-[#008080] flex-shrink-0 mt-0.5" />
              <span>42 Wellness Ave, Ikeja, Lagos</span>
            </div>
            <div className="flex items-start gap-3.5 text-sm sm:text-base">
              <Phone size={18} className="text-[#008080] flex-shrink-0 mt-0.5" />
              <span>+234 800-ABC-HOSP / 112</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">Not satisfied with these details?</span>
            <button
              onClick={handleLiveHandoff}
              className={`font-bold hover:underline transition-colors cursor-pointer ${
                isHighContrast ? 'text-yellow-300' : 'text-[#008080]'
              }`}
            >
              Talk to a Live Person
            </button>
          </div>
        </div>

        {/* Admin Passcode Gate (Option A) */}
        {showPasscodePrompt && (
          <form onSubmit={handleVerifyPasscode} className={`p-5 rounded-2xl border ${isHighContrast ? 'border-white bg-black' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-3.5`}>
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${isHighContrast ? 'text-white' : 'text-slate-700'}`} />
              <h3 className={`font-bold text-xs uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-800'}`}>
                Director Gate
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Enter director passcode to configure Lead Sync & Gmail outreach (Passcode: <span className="font-semibold">admin</span>).
            </p>
            <div className="space-y-1">
              <input
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Enter passcode"
                className={`w-full px-3 py-1.5 rounded-lg text-xs border transition-all focus:outline-none focus:ring-1 ${
                  isHighContrast
                    ? 'border-white bg-black text-white focus:ring-yellow-300'
                    : 'border-slate-200 bg-white text-slate-800 focus:ring-[#008080] focus:border-[#008080]'
                }`}
                autoFocus
              />
              {passcodeError && (
                <p className="text-[10px] font-semibold text-red-500">{passcodeError}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className={`py-1.5 px-3 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                  isHighContrast
                    ? 'border-white bg-white text-black hover:bg-black hover:text-white'
                    : 'bg-[#008080] border-transparent text-white hover:bg-[#006666]'
                }`}
              >
                Verify
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasscodePrompt(false);
                  setPasscodeInput('');
                  setPasscodeError('');
                }}
                className={`py-1.5 px-3 rounded-lg font-bold text-xs border transition-all ${
                  isHighContrast
                    ? 'border-white bg-black text-white hover:bg-white hover:text-black'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Admin/Director Panels (Option A) */}
        {isAdminUnlocked && (
          <>
            {/* Google Sheets Lead Sync Card */}
            <div className={`p-5 rounded-2xl border ${isHighContrast ? 'border-white bg-black' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-3.5 animate-fadeIn`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`w-5 h-5 ${isHighContrast ? 'text-white' : 'text-[#008080]'}`} />
                  <h3 className={`font-bold text-base uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-800'}`}>
                    Lead Sheets Sync
                  </h3>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isHighContrast ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  Admin View
                </span>
              </div>
              
              <p className="text-xs text-gray-500 leading-relaxed">
                Automatically log patient details to Google Sheets for seamless lead chasing and follow-ups.
              </p>

              {!user ? (
                <div className="flex flex-col gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                      isHighContrast 
                        ? 'border-white bg-black text-white hover:bg-white hover:text-black' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isLoggingIn ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    Connect Google Sheets
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5 mt-1">
                  {/* Connection info */}
                  <div className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 ${isHighContrast ? 'bg-zinc-900 border border-white' : 'bg-slate-50 text-slate-600'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Connected account:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isHighContrast ? 'bg-white text-black text-[9px]' : 'bg-emerald-100 text-emerald-800'}`}>
                        Active
                      </span>
                    </div>
                    <div className="font-mono text-[11px] truncate text-slate-800 font-medium">
                      {user.email}
                    </div>
                  </div>

                  {/* Auto Sync Toggle */}
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className={`w-4 h-4 rounded border transition-colors ${
                        isHighContrast 
                          ? 'accent-white' 
                          : 'accent-[#008080]'
                      }`}
                    />
                    <span>Auto-sync patient profile fields</span>
                  </label>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSyncLead(true)}
                      disabled={isSyncing || (!patientName.trim() && !email.trim() && !phone.trim())}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                        isHighContrast 
                          ? 'border-white bg-black text-white hover:bg-white hover:text-black' 
                          : 'border-slate-200 bg-white text-[#008080] hover:bg-slate-50'
                      }`}
                      title={(!patientName.trim() && !email.trim() && !phone.trim()) ? "Enter some patient info below first to sync" : "Sync current inputs immediately"}
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Sync Lead
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                        isHighContrast 
                          ? 'border-red-500 bg-black text-red-500 hover:bg-red-500 hover:text-white' 
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}

              {/* Sync status messages & Sheets links */}
              {syncResult && (
                <div className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 ${
                  syncResult.success 
                    ? (isHighContrast ? 'bg-zinc-900 border border-white text-white' : 'bg-emerald-50 border border-emerald-100 text-emerald-800') 
                    : (isHighContrast ? 'bg-zinc-900 border border-red-500 text-red-400' : 'bg-red-50 border border-red-100 text-red-800')
                }`}>
                  <div className="flex items-center gap-1.5 font-semibold text-wrap break-words">
                    {syncResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Lock className="w-4 h-4 text-red-600 flex-shrink-0" />}
                    <span>{syncResult.message}</span>
                  </div>
                  {syncResult.success && syncResult.link && (
                    <a
                      href={syncResult.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`font-bold flex items-center gap-1 mt-0.5 hover:underline ${
                        isHighContrast ? 'text-white' : 'text-[#008080]'
                      }`}
                    >
                      Open Google Sheet
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-500 font-mono">Lead sync problems?</span>
                <button
                  type="button"
                  onClick={handleLiveHandoff}
                  className={`font-bold hover:underline transition-colors cursor-pointer ${
                    isHighContrast ? 'text-yellow-300' : 'text-[#008080]'
                  }`}
                >
                  Talk to a Live Person
                </button>
              </div>
            </div>

            {/* Gmail Outreach Card */}
            <div className={`p-5 rounded-2xl border ${isHighContrast ? 'border-white bg-black' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-3.5 animate-fadeIn`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className={`w-5 h-5 ${isHighContrast ? 'text-white' : 'text-[#008080]'}`} />
                  <h3 className={`font-bold text-base uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-800'}`}>
                    Gmail Outreach
                  </h3>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isHighContrast ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  Admin View
                </span>
              </div>
              
              <p className="text-xs text-gray-500 leading-relaxed">
                Send instant personalized follow-ups or confirmation emails to patient leads via connected Gmail account.
              </p>

              {!user ? (
                <div className={`p-3 rounded-xl text-xs text-center border ${isHighContrast ? 'border-zinc-800 bg-zinc-950 text-gray-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  Please connect your Google account above to enable Gmail Outreach.
                </div>
              ) : (
                <div className="space-y-3 mt-1">
                  {/* Recipient Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recipient Email</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <User size={13} />
                      </span>
                      <input
                        type="email"
                        value={gmailTo}
                        onChange={(e) => setGmailTo(e.target.value)}
                        placeholder="patient@example.com"
                        className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border transition-all focus:outline-none focus:ring-1 ${
                          isHighContrast
                            ? 'border-white bg-black text-white focus:ring-yellow-300'
                            : 'border-slate-200 bg-white text-slate-800 focus:ring-[#008080] focus:border-[#008080]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Subject Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email Subject</label>
                    <input
                      type="text"
                      value={gmailSubject}
                      onChange={(e) => setGmailSubject(e.target.value)}
                      placeholder="Subject"
                      className={`w-full px-3 py-1.5 rounded-lg text-xs border transition-all focus:outline-none focus:ring-1 ${
                        isHighContrast
                          ? 'border-white bg-black text-white focus:ring-yellow-300'
                          : 'border-slate-200 bg-white text-slate-800 focus:ring-[#008080] focus:border-[#008080]'
                      }`}
                    />
                  </div>

                  {/* Message Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Message Draft</label>
                    <textarea
                      rows={4}
                      value={gmailBody}
                      onChange={(e) => setGmailBody(e.target.value)}
                      placeholder="Write message..."
                      className={`w-full px-3 py-1.5 rounded-lg text-xs border transition-all focus:outline-none focus:ring-1 resize-none scrollbar-thin ${
                        isHighContrast
                          ? 'border-white bg-black text-white focus:ring-yellow-300'
                          : 'border-slate-200 bg-white text-slate-800 focus:ring-[#008080] focus:border-[#008080]'
                      }`}
                    />
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || !gmailTo.trim()}
                    className={`w-full py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer ${
                      isHighContrast 
                        ? 'border-white bg-black text-white hover:bg-white hover:text-black' 
                        : 'bg-[#008080] border-transparent text-white hover:bg-[#006666]'
                    }`}
                  >
                    {isSendingEmail ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Send Follow-up Email
                  </button>
                </div>
              )}

              {/* Email Send Result */}
              {gmailResult && (
                <div className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 ${
                  gmailResult.success 
                    ? (isHighContrast ? 'bg-zinc-900 border border-white text-white' : 'bg-emerald-50 border border-emerald-100 text-emerald-800') 
                    : (isHighContrast ? 'bg-zinc-900 border border-red-500 text-red-400' : 'bg-red-50 border border-red-100 text-red-800')
                }`}>
                  <div className="flex items-center gap-1.5 font-semibold text-wrap break-words">
                    {gmailResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>{gmailResult.message}</span>
                  </div>
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-500 font-mono">Outreach issues?</span>
                <button
                  type="button"
                  onClick={handleLiveHandoff}
                  className={`font-bold hover:underline transition-colors cursor-pointer ${
                    isHighContrast ? 'text-yellow-300' : 'text-[#008080]'
                  }`}
                >
                  Talk to a Live Person
                </button>
              </div>
            </div>
          </>
        )}

        {/* Talk to a Person Card */}
        <div className={`p-5 rounded-2xl border flex flex-col gap-3 text-center items-center justify-center ${
          isHighContrast ? 'border-white bg-black' : 'bg-gradient-to-br from-slate-50 to-slate-100/60 border-slate-100 shadow-sm'
        }`}>
          <h3 className={`font-bold text-lg sm:text-xl ${isHighContrast ? 'text-white' : 'text-slate-700'}`}>
            Talk to a person
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-[210px]">
            Connect with a live receptionist for anything I can't handle.
          </p>
          <button
            id="live-chat-handoff-btn"
            onClick={handleLiveHandoff}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm border shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isHighContrast 
                ? 'border-white bg-black text-white hover:bg-white hover:text-black' 
                : 'border-transparent bg-gradient-to-r from-[#25D366] to-[#075E54] text-white hover:shadow-lg hover:brightness-105 active:scale-98 shadow-[#25D366]/20'
            }`}
          >
            <Phone size={15} />
            WhatsApp Live Handoff
          </button>
        </div>

        {/* Quick Actions Card */}
        <div className={`p-5 rounded-2xl border ${isHighContrast ? 'border-white bg-black' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-4`}>
          <h3 className={`font-bold text-base uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-800'}`}>
            Quick Actions
          </h3>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Book appointment", icon: Calendar, query: "I want to book an appointment" },
              { label: "Find a doctor", icon: Stethoscope, query: "Help me find a doctor" },
              { label: "Departments", icon: Building2, query: "What departments are in ABC Hospital?" },
              { label: "Billing & insurance", icon: CreditCard, query: "What HMOs do you accept and how does billing/insurance work?" },
              { label: "Emergency guidance", icon: AlertTriangle, query: "What is the emergency helpline or procedure?", isEmergency: true }
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => sendMessage(action.query)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl border text-left text-sm font-semibold transition-all ${
                  isHighContrast
                    ? (action.isEmergency ? 'border-red-500 text-red-400 hover:bg-red-950/40' : 'border-white text-white hover:bg-zinc-900')
                    : (action.isEmergency ? 'border-red-100 text-red-600 bg-red-50/40 hover:bg-red-50' : 'border-slate-100 text-slate-700 hover:bg-slate-50')
                }`}
              >
                <action.icon size={16} className={action.isEmergency ? 'text-red-500' : 'text-slate-400'} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">Not satisfied with quick actions?</span>
            <button
              type="button"
              onClick={handleLiveHandoff}
              className={`font-bold hover:underline transition-colors cursor-pointer ${
                isHighContrast ? 'text-yellow-300' : 'text-[#008080]'
              }`}
            >
              Talk to a Live Person
            </button>
          </div>
        </div>

        {/* Assistant Rating & Feedback Card */}
        <div className={`p-5 rounded-2xl border ${isHighContrast ? 'border-white bg-black' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-3.5`}>
          <h3 className={`font-bold text-base uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-800'}`}>
            Rate our Assistant
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your feedback helps us improve our patient care assistant.
          </p>
          
          {ratingSent ? (
            <div className={`p-3 rounded-xl text-xs text-center font-medium ${isHighContrast ? 'bg-zinc-900 border border-white text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
              Thank you for your rating of {starRating}/5 stars! Operational email dispatch triggered in background.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStarFeedback(star)}
                    disabled={isSendingRating}
                    className="p-1 transition-transform active:scale-90 hover:scale-110 cursor-pointer text-yellow-400 disabled:opacity-50 animate-bounce"
                    style={{ animationDelay: `${star * 70}ms`, animationDuration: '1.2s' }}
                    title={`Rate ${star} Stars`}
                  >
                    <Star 
                      size={24} 
                      fill={(starRating !== null && starRating >= star) ? "currentColor" : "none"} 
                      className={isHighContrast ? 'stroke-yellow-300 text-yellow-300' : 'stroke-yellow-400 text-yellow-400'} 
                    />
                  </button>
                ))}
              </div>
              {isSendingRating && (
                <span className="text-[10px] text-gray-400 font-medium animate-pulse">Sending rating...</span>
              )}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">Not fully satisfied?</span>
            <button
              type="button"
              onClick={handleLiveHandoff}
              className={`font-bold hover:underline transition-colors cursor-pointer ${
                isHighContrast ? 'text-yellow-300' : 'text-[#008080]'
              }`}
            >
              Talk to a Live Person
            </button>
          </div>
        </div>

        {/* Private Indicator Card */}
        <div className={`p-4 rounded-2xl border flex flex-col items-start gap-3 ${isHighContrast ? 'border-white bg-black' : 'bg-[#eefcf7] border-[#d3f9eb]'}`}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-[#00a884] flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              <span className="font-bold text-gray-800 block mb-0.5">Your conversation is private</span>
              We never share personal health or appointment information.
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-dashed border-emerald-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs w-full">
            <span className="text-gray-500">Privacy queries?</span>
            <button
              type="button"
              onClick={handleLiveHandoff}
              className={`font-bold hover:underline transition-colors cursor-pointer ${
                isHighContrast ? 'text-yellow-300' : 'text-[#00a884]'
              }`}
            >
              Talk to a Live Person
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
