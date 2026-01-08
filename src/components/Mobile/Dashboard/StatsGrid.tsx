import React from 'react';
import { Building2, CheckCircle, Calendar, Gift, Utensils, FileText } from 'lucide-react';

interface MonthlyStats {
  turniOggi: number;
  turniTotaliMese: number;
  turniCompletati: number;
  eventiOggi: number;
  eventiTotaliMese: number;
  eventiCompletati: number;
  buoniPastoAssegnati: number;
  pastiAziendaliUsufruiti: number;
  noteSpeseInviate: number;
}

interface StatsGridProps {
  monthlyStats: MonthlyStats;
  onNavigate?: (tab: string) => void;
}

const StatsGrid: React.FC<StatsGridProps> = ({ monthlyStats, onNavigate }) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* RIGA 1: TURNI */}
      <button
        onClick={() => onNavigate?.('checkin')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-purple-500 transition-all cursor-pointer"
      >
        <Building2 className="h-6 w-6 mx-auto mb-2 text-purple-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.turniOggi}</div>
        <div className="text-xs text-gray-400">Turni Oggi</div>
      </button>
      
      <button
        onClick={() => onNavigate?.('calendar')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-purple-500 transition-all cursor-pointer"
      >
        <Building2 className="h-6 w-6 mx-auto mb-2 text-purple-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.turniTotaliMese}</div>
        <div className="text-xs text-gray-400">Turni Mese</div>
      </button>
      
      <button
        onClick={() => onNavigate?.('report')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-green-500 transition-all cursor-pointer"
      >
        <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.turniCompletati}</div>
        <div className="text-xs text-gray-400">Turni Completati</div>
      </button>
      
      {/* RIGA 2: EVENTI */}
      <button
        onClick={() => onNavigate?.('checkin')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-blue-500 transition-all cursor-pointer"
      >
        <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.eventiOggi}</div>
        <div className="text-xs text-gray-400">Eventi Oggi</div>
      </button>
      
      <button
        onClick={() => onNavigate?.('calendar')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-blue-500 transition-all cursor-pointer"
      >
        <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.eventiTotaliMese}</div>
        <div className="text-xs text-gray-400">Eventi Mese</div>
      </button>
      
      <button
        onClick={() => onNavigate?.('report')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-green-500 transition-all cursor-pointer"
      >
        <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.eventiCompletati}</div>
        <div className="text-xs text-gray-400">Eventi Completati</div>
      </button>
      
      {/* RIGA 3: PASTI E SPESE */}
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
        <Gift className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.buoniPastoAssegnati}</div>
        <div className="text-xs text-gray-400">Buoni Pasto</div>
      </div>
      
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
        <Utensils className="h-6 w-6 mx-auto mb-2 text-orange-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.pastiAziendaliUsufruiti}</div>
        <div className="text-xs text-gray-400">Pasti Azienda</div>
      </div>
      
      <button
        onClick={() => onNavigate?.('requests')}
        className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center hover:bg-gray-700 hover:border-cyan-500 transition-all cursor-pointer"
      >
        <FileText className="h-6 w-6 mx-auto mb-2 text-cyan-400" />
        <div className="text-xl font-bold text-white">{monthlyStats.noteSpeseInviate}</div>
        <div className="text-xs text-gray-400">Note Spese</div>
      </button>
    </div>
  );
};

export default StatsGrid;