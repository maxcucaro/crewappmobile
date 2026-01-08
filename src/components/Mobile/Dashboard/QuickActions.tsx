import React from 'react';
import { Calendar, CheckCircle } from 'lucide-react';

interface QuickActionsProps {
  onNavigate?: (tab: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button 
        onClick={() => onNavigate?.('calendar')}
        className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 text-left hover:from-blue-700 hover:to-cyan-700 transition-all"
      >
        <Calendar className="h-8 w-8 mb-2 text-white" />
        <div className="text-white font-bold">Calendario</div>
        <div className="text-blue-100 text-sm">Vedi tutti gli eventi</div>
      </button>
      
      <button 
        onClick={() => onNavigate?.('checkin')}
        className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 text-left hover:from-purple-700 hover:to-pink-700 transition-all"
      >
        <CheckCircle className="h-8 w-8 mb-2 text-white" />
        <div className="text-white font-bold">Check-in</div>
        <div className="text-purple-100 text-sm">QR Code e GPS</div>
      </button>
    </div>
  );
};

export default QuickActions;