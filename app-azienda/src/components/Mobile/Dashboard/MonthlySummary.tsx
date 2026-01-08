import React from 'react';
import { Building2, Calendar, Plane, DollarSign } from 'lucide-react';

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
  totalBaseAmount: number;
  totalBenefitsAmount: number;
  warehouseEvents: number;
  regularEvents: number;
  travelEvents: number;
}

interface MonthlySummaryProps {
  monthlyStats: MonthlyStats;
}

const MonthlySummary: React.FC<MonthlySummaryProps> = ({ monthlyStats }) => {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">
        Riepilogo {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
      </h3>
      
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-300">Guadagno Base Mensile:</span>
            <span className="text-xl font-bold text-green-400">€{monthlyStats.totalBaseAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-300">Benefit Extra Mensili:</span>
            <span className="text-xl font-bold text-yellow-400">€{monthlyStats.totalBenefitsAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-gray-600 pt-3">
            <span className="text-white font-bold">Totale Stimato:</span>
            <span className="text-2xl font-bold text-blue-400">
              €{(monthlyStats.totalBaseAmount + monthlyStats.totalBenefitsAmount).toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <Building2 className="h-6 w-6 mx-auto mb-1 text-gray-400" />
            <div className="text-lg font-bold text-white">{monthlyStats.warehouseEvents}</div>
            <div className="text-xs text-gray-400">Turni</div>
          </div>
          
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <Calendar className="h-6 w-6 mx-auto mb-1 text-blue-400" />
            <div className="text-lg font-bold text-white">{monthlyStats.regularEvents}</div>
            <div className="text-xs text-gray-400">Eventi Standard</div>
          </div>
          
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <Plane className="h-6 w-6 mx-auto mb-1 text-purple-400" />
            <div className="text-lg font-bold text-white">{monthlyStats.travelEvents}</div>
            <div className="text-xs text-gray-400">Trasferte</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlySummary;