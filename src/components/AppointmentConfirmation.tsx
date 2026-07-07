import React from 'react';
import { Calendar, Clock, User, Building2, CheckCircle2, Mail, Phone } from 'lucide-react';

interface AppointmentConfirmationProps {
  doctor: string;
  date: string;
  time: string;
  department: string;
  patientName: string;
  email: string;
  phone: string;
  isHighContrast?: boolean;
  onCancel: () => void;
  onReschedule: () => void;
}

export function AppointmentConfirmation({
  doctor,
  date,
  time,
  department,
  patientName,
  email,
  phone,
  isHighContrast,
  onCancel,
  onReschedule
}: AppointmentConfirmationProps) {
  return (
    <div className={`mt-4 w-full max-w-md rounded-xl border p-4 shadow-sm ${
      isHighContrast ? 'bg-black border-white text-white' : 'bg-white border-green-200'
    }`}>
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className={`w-6 h-6 ${isHighContrast ? 'text-white' : 'text-green-600'}`} />
        <h3 className="font-semibold text-lg sm:text-xl">Appointment Confirmed</h3>
      </div>

      {patientName && (
        <p className={`text-sm sm:text-base mb-3 ${isHighContrast ? 'text-gray-300' : 'text-gray-600'}`}>
          Hello <span className={`font-semibold ${isHighContrast ? 'text-white' : 'text-gray-900'}`}>{patientName}</span>, your appointment has been successfully scheduled.
        </p>
      )}
      
      <div className={`space-y-3 p-3 rounded-lg border ${
        isHighContrast ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-gray-50'
      }`}>
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-bold">Doctor</p>
            <p className="font-medium text-sm sm:text-base">{doctor}</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-bold">Department</p>
            <p className="font-medium text-sm sm:text-base">{department}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-bold">Date</p>
            <p className="font-medium text-sm sm:text-base">{date}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-bold">Time</p>
            <p className="font-medium text-sm sm:text-base">{time}</p>
          </div>
        </div>

        {(email || phone) && (
          <div className="pt-2 border-t border-gray-200/50 mt-2 space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Contact Details</p>
            {email && (
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{phone}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onReschedule}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm sm:text-base transition-colors border ${
            isHighContrast 
              ? 'border-white hover:bg-gray-800' 
              : 'border-red-200 text-red-700 hover:bg-red-50'
          }`}
        >
          Reschedule
        </button>
        <button
          onClick={onCancel}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm sm:text-base transition-colors border ${
            isHighContrast 
              ? 'border-red-500 text-red-500 hover:bg-red-950' 
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
