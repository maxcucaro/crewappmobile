import React from 'react';
import { Clock, MapPin, Plane, Gift, CheckCircle, AlertTriangle, CreditCard as Edit, Euro, Coffee, Star } from 'lucide-react';

interface EventShiftCardProps {
  report: {
    assignment: {
      id: string;
      evento_id: string;
      nome_evento: string;
      nome_azienda: string;
      giorno_inizio_evento: string;
      giorno_fine_evento: string;
      evento_localita: string;
      evento_orario_convocazione?: string;
      evento_trasferta: boolean;
      tariffa_evento_assegnata?: number;
      bonus_previsti?: number;
      bonus_trasferta?: boolean;
      bonus_diaria?: boolean;
      benefits_evento_nomi?: string[];
    };
    timesheet?: {
      id: string;
      start_time: string;
      end_time?: string;
      status: string;
      total_hours?: number;
      meal_voucher?: boolean;
      meal_voucher_amount?: number;
      company_meal?: boolean;
      company_meal_cost?: number;
      diaria_type?: string;
      diaria_amount?: number;
      other_benefits_amount?: number;
      total_benefits?: number;
      is_rectified?: boolean;
      rectification_notes?: string;
      original_start_time?: string;
      original_end_time?: string;
      rectified_start_time?: string;
      rectified_end_time?: string;
      convocation_start_time?: string;
      convocation_end_time?: string;
    };
    benefitBreakdown?: {
      name: string;
      amount: number;
      category: string;
      applied: boolean;
      reason?: string;
    }[];
  };
  onRectify: () => void;
}

const EventShiftCard: React.FC<EventShiftCardProps> = ({ report, onRectify }) => {
  const { assignment, timesheet, benefitBreakdown } = report;

  const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return 'Non specificato';

    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
      return timeString.substring(0, 5);
    }

    try {
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      console.error('Errore parsing timestamp:', e);
    }

    return timeString;
  };

  const getDiariaLabel = (type: string | undefined) => {
    switch (type) {
      case 'evento': return 'Diaria Eventi';
      case 'trasferta': return 'Diaria Trasferta';
      default: return null;
    }
  };

  // Determina gli orari effettivi (rettificati o originali)
  const effectiveStartTime = timesheet?.rectified_start_time || timesheet?.start_time;
  const effectiveEndTime = timesheet?.rectified_end_time || timesheet?.end_time;

  // Un evento è completato se ha sia check-in che check-out (originali O rettificati)
  const isCompleted = timesheet && effectiveStartTime && effectiveEndTime;

  // Calcola il totale dai benefit breakdown se disponibili
  const calculatedTotalBenefits = benefitBreakdown && benefitBreakdown.length > 0
    ? benefitBreakdown.reduce((sum, b) => b.applied ? sum + b.amount : sum, 0)
    : 0;

  const totalBenefits = timesheet?.total_benefits || calculatedTotalBenefits;
  const hasAnyBenefits = totalBenefits > 0 || (benefitBreakdown && benefitBreakdown.some(b => b.applied));

  const hasBonusPrevisti = assignment.bonus_previsti && assignment.bonus_previsti > 0;
  const hasBenefitsPrevisti = assignment.benefits_evento_nomi && assignment.benefits_evento_nomi.length > 0;
  const showExpectedBenefits = !isCompleted && !hasAnyBenefits && (hasBonusPrevisti || hasBenefitsPrevisti || assignment.bonus_trasferta || assignment.bonus_diaria);

  return (
    <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-bold text-white">{assignment.nome_evento}</h4>
            {timesheet?.is_rectified && (
              <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded font-semibold">
                Rettificato
              </span>
            )}
          </div>
          <p className="text-sm text-blue-400">{assignment.nome_azienda}</p>
          <p className="text-xs text-gray-400">
            {new Date(assignment.giorno_inizio_evento).toLocaleDateString('it-IT')}
            {assignment.giorno_inizio_evento !== assignment.giorno_fine_evento && (
              <> - {new Date(assignment.giorno_fine_evento).toLocaleDateString('it-IT')}</>
            )}
          </p>
        </div>
      </div>

      {assignment.evento_orario_convocazione && (
        <div className="bg-green-900 bg-opacity-30 border-2 border-green-600 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-center space-x-2">
            <Clock className="h-5 w-5 text-green-400" />
            <div>
              <div className="text-xs text-green-200">Orario Convocazione</div>
              <div className="text-xl font-bold text-green-400">
                {formatTime(assignment.evento_orario_convocazione)}
              </div>
            </div>
          </div>
        </div>
      )}

      {timesheet?.convocation_start_time && timesheet?.convocation_end_time && (
        <div className="bg-cyan-900 bg-opacity-30 border border-cyan-600 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            <h5 className="text-sm font-medium text-cyan-400">Orari Convocazione</h5>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400">Inizio:</span>
              <div className="text-white font-bold mt-1">
                {formatTime(timesheet.convocation_start_time)}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Fine:</span>
              <div className="text-white font-bold mt-1">
                {formatTime(timesheet.convocation_end_time)}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCompleted ? (
        <div className="bg-gray-800 rounded-lg p-3 mb-3 border-l-4 border-blue-500">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <h5 className="text-sm font-medium text-blue-400">Orari Effettivi</h5>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <div>
              <span className="text-gray-400">Check-in:</span>
              <div className="text-white font-bold mt-1">
                {formatTime(effectiveStartTime)}
              </div>
              {timesheet?.is_rectified && timesheet?.original_start_time && (
                <div className="text-gray-500 line-through text-xs mt-1">
                  Era: {formatTime(timesheet.original_start_time)}
                </div>
              )}
            </div>
            <div>
              <span className="text-gray-400">Check-out:</span>
              <div className="text-white font-bold mt-1">
                {formatTime(effectiveEndTime)}
              </div>
              {timesheet?.is_rectified && timesheet?.original_end_time && (
                <div className="text-gray-500 line-through text-xs mt-1">
                  Era: {formatTime(timesheet.original_end_time)}
                </div>
              )}
              {timesheet?.is_rectified && !timesheet.original_end_time && timesheet?.rectified_end_time && (
                <div className="text-xs text-green-400 mt-1 flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>Aggiunto via rettifica</span>
                </div>
              )}
            </div>
          </div>
          {timesheet?.total_hours && (
            <div className="border-t border-gray-700 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Ore Totali:</span>
                <span className="text-sm font-bold text-blue-400">
                  {timesheet.total_hours}h
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-3 mb-3 border-l-4 border-gray-600">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-gray-500" />
            <span className="text-xs text-gray-400">
              {timesheet ? 'Turno in corso - Check-out non effettuato' : 'Nessun check-in registrato'}
            </span>
          </div>
        </div>
      )}

      {hasAnyBenefits && (
        <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2 mb-3">
            <Gift className="h-4 w-4 text-green-400" />
            <h5 className="text-sm font-medium text-green-400">
              {isCompleted ? 'Benefit Ricevuti' : 'Benefit Assegnati'}
            </h5>
          </div>

          <div className="space-y-2">
            {timesheet?.meal_voucher && timesheet?.meal_voucher_amount && timesheet.meal_voucher_amount > 0 && (
              <div className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <Coffee className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-200">Buono Pasto</span>
                </div>
                <span className="text-sm font-bold text-yellow-400">
                  €{timesheet.meal_voucher_amount.toFixed(2)}
                </span>
              </div>
            )}

            {timesheet?.company_meal && timesheet?.company_meal_cost && timesheet.company_meal_cost > 0 && (
              <div className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <Coffee className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-gray-200">Pasto Aziendale</span>
                </div>
                <span className="text-sm font-bold text-orange-400">
                  €{timesheet.company_meal_cost.toFixed(2)}
                </span>
              </div>
            )}

            {timesheet?.diaria_type && timesheet.diaria_type !== 'nessuna' && timesheet?.diaria_amount && timesheet.diaria_amount > 0 && (
              <div className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                <div className="flex items-center space-x-2">
                  <Plane className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-gray-200">{getDiariaLabel(timesheet.diaria_type)}</span>
                </div>
                <span className="text-sm font-bold text-purple-400">
                  €{timesheet.diaria_amount.toFixed(2)}
                </span>
              </div>
            )}

            {benefitBreakdown && benefitBreakdown.length > 0 && benefitBreakdown.map((benefit, idx) => {
              if (!benefit.applied) return null;

              const getCategoryIcon = (category: string) => {
                switch(category?.toLowerCase()) {
                  case 'trasferta': return Plane;
                  case 'benefit': return Gift;
                  case 'rimborso': return Euro;
                  default: return Star;
                }
              };

              const getCategoryColor = (category: string) => {
                switch(category?.toLowerCase()) {
                  case 'trasferta': return 'text-purple-400';
                  case 'benefit': return 'text-green-400';
                  case 'rimborso': return 'text-cyan-400';
                  default: return 'text-yellow-400';
                }
              };

              const Icon = getCategoryIcon(benefit.category);
              const colorClass = getCategoryColor(benefit.category);

              return (
                <div key={idx} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                    <span className="text-sm text-gray-200">{benefit.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${colorClass}`}>
                    €{benefit.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}

            <div className="flex items-center justify-between bg-blue-900 bg-opacity-30 border border-blue-700 rounded px-3 py-2 mt-3">
              <span className="text-sm font-bold text-white">Totale Benefit:</span>
              <span className="text-lg font-bold text-blue-400">
                €{totalBenefits.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {showExpectedBenefits && (
        <div className="bg-blue-900 bg-opacity-20 border border-blue-600 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2 mb-2">
            <Star className="h-4 w-4 text-blue-400" />
            <h5 className="text-sm font-medium text-blue-400">Bonus/Benefit Previsti</h5>
          </div>
          <div className="space-y-1 text-xs">
            {assignment.tariffa_evento_assegnata && (
              <div className="flex items-center justify-between text-gray-200">
                <span>Tariffa Base:</span>
                <span className="font-semibold">€{assignment.tariffa_evento_assegnata.toFixed(2)}</span>
              </div>
            )}
            {hasBonusPrevisti && (
              <div className="flex items-center justify-between text-yellow-300">
                <span>Bonus Fisso:</span>
                <span className="font-semibold">€{assignment.bonus_previsti!.toFixed(2)}</span>
              </div>
            )}
            {assignment.bonus_trasferta && (
              <div className="flex items-center text-purple-300">
                <span>Bonus Trasferta Previsto</span>
              </div>
            )}
            {assignment.bonus_diaria && (
              <div className="flex items-center text-purple-300">
                <span>Diaria Prevista</span>
              </div>
            )}
            {hasBenefitsPrevisti && (
              <div className="mt-2 pt-2 border-t border-blue-800">
                <div className="text-blue-200 mb-1">Altri benefit previsti:</div>
                <div className="flex flex-wrap gap-1">
                  {assignment.benefits_evento_nomi!.map((benefit, idx) => (
                    <span key={idx} className="bg-blue-800 text-blue-200 px-2 py-0.5 rounded text-xs">
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-blue-800 text-blue-200 text-center">
              💡 Gli importi effettivi verranno calcolati al check-out
            </div>
          </div>
        </div>
      )}

      {timesheet?.is_rectified && timesheet.rectification_notes && (
        <div className="bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-3 mb-3">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-orange-200 mb-1">Nota di Rettifica:</div>
              <div className="text-xs text-orange-300">{timesheet.rectification_notes}</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 mb-3">
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-cyan-400" />
          <span className="text-sm text-white">{assignment.evento_localita}</span>
        </div>

        {assignment.evento_trasferta && (
          <div className="flex items-center space-x-2">
            <Plane className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-purple-300">Evento con Trasferta</span>
          </div>
        )}
      </div>

      <button
        onClick={onRectify}
        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors border border-orange-500"
      >
        <Edit className="h-4 w-4" />
        <span>RETTIFICA ORARIO</span>
      </button>

      {!isCompleted && timesheet && (
        <div className="mt-2 text-xs text-center text-gray-400">
          I benefit verranno calcolati al check-out
        </div>
      )}
    </div>
  );
};

export default EventShiftCard;
