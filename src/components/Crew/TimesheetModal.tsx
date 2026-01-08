import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

interface GPSLocation {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp: Date;
}

interface TimeEntry {
  id: string;
  eventTitle: string;
  eventId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakTime: number;
  totalHours: number;
  totalDays?: number;
  trackingType: 'hours' | 'days';
  hourlyRate?: number;
  dailyRate?: number;
  retentionPercentage: number;
  grossAmount: number;
  netAmount: number;
  paymentStatus: 'pending' | 'paid_by_company' | 'received_by_crew' | 'confirmed';
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  gpsLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: Date;
  };
  companyMeal?: boolean;
  mealVoucher?: boolean;
}

interface TimesheetModalProps {
  entry: TimeEntry | null;
  isEditing: boolean;
  currentLocation: GPSLocation | null;
  hasMealOptions: boolean;
  onSave: (entryData: Partial<TimeEntry>) => void;
  onClose: () => void;
}

const TimesheetModal: React.FC<TimesheetModalProps> = ({ 
  entry, 
  isEditing, 
  currentLocation, 
  hasMealOptions,
  onSave, 
  onClose 
}) => {
  const [formData, setFormData] = useState({
    eventTitle: entry?.eventTitle || '',
    date: entry?.date || new Date().toISOString().split('T')[0],
    startTime: entry?.startTime || '',
    endTime: entry?.endTime || '',
    breakTime: entry?.breakTime || 0,
    trackingType: entry?.trackingType || 'hours' as 'hours' | 'days',
    hourlyRate: entry?.hourlyRate || 25,
    dailyRate: entry?.dailyRate || 200,
    retentionPercentage: entry?.retentionPercentage || 15,
    notes: entry?.notes || '',
    totalDays: entry?.totalDays || 1,
    companyMeal: entry?.companyMeal || false,
    mealVoucher: entry?.mealVoucher || false
  });

  const totalHours = calculateTotalHours(formData.startTime, formData.endTime, formData.breakTime);
  const grossAmount = formData.trackingType === 'hours' 
    ? totalHours * formData.hourlyRate 
    : formData.totalDays * formData.dailyRate;
  const netAmount = grossAmount * (1 - formData.retentionPercentage / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      totalHours: formData.trackingType === 'hours' ? totalHours : undefined,
      totalDays: formData.trackingType === 'days' ? formData.totalDays : undefined,
      grossAmount,
      netAmount
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Current Location Display */}
      {currentLocation && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Posizione Corrente</p>
              <p className="text-xs text-green-700">{currentLocation.address}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Evento</label>
          <input
            type="text"
            value={formData.eventTitle}
            onChange={(e) => setFormData({ ...formData, eventTitle: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Data</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo Tracking</label>
          <select
            value={formData.trackingType}
            onChange={(e) => setFormData({ ...formData, trackingType: e.target.value as 'hours' | 'days' })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="hours">Ore Lavorate</option>
            <option value="days">Giorni Lavorati</option>
          </select>
        </div>
      </div>

      {formData.trackingType === 'hours' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ora Inizio</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Ora Fine</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Pausa (minuti)</label>
              <input
                type="number"
                value={formData.breakTime}
                onChange={(e) => setFormData({ ...formData, breakTime: Number(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Tariffa (€/h)</label>
              <input
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
                step="0.5"
                required
              />
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Numero Giorni</label>
            <input
              type="number"
              value={formData.totalDays}
              onChange={(e) => setFormData({ ...formData, totalDays: Number(e.target.value) })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              min="0.5"
              step="0.5"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Tariffa (€/giorno)</label>
            <input
              type="number"
              value={formData.dailyRate}
              onChange={(e) => setFormData({ ...formData, dailyRate: Number(e.target.value) })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              min="0"
              step="1"
              required
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Percentuale Trattenuta (%)</label>
        <input
          type="number"
          value={formData.retentionPercentage}
          onChange={(e) => setFormData({ ...formData, retentionPercentage: Number(e.target.value) })}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          min="0"
          max="100"
          step="0.5"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Percentuale trattenuta dall'azienda</p>
      </div>
      
      {/* Meal Options */}
      {hasMealOptions && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Opzioni Pasto</h4>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.companyMeal}
                onChange={(e) => setFormData({ ...formData, companyMeal: e.target.checked })}
                className="rounded border-gray-300"
              />
              <div>
                <span className="text-sm text-gray-700">Pasto Aziendale</span>
                <p className="text-xs text-gray-500">L'azienda anticipa il costo del pasto che verrà detratto dallo stipendio</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.mealVoucher}
                onChange={(e) => setFormData({ ...formData, mealVoucher: e.target.checked })}
                className="rounded border-gray-300"
              />
              <div>
                <span className="text-sm text-gray-700">Buono Pasto</span>
                <p className="text-xs text-gray-500">Riceverai un buono pasto per questa giornata di lavoro</p>
              </div>
            </label>
          </div>
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Note</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          rows={3}
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        {formData.trackingType === 'hours' ? (
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Ore Totali:</span>
            <span className="text-sm font-bold text-gray-900">{totalHours.toFixed(1)}h</span>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Giorni Totali:</span>
            <span className="text-sm font-bold text-gray-900">{formData.totalDays}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Importo Lordo:</span>
          <span className="text-sm font-bold text-gray-900">€{grossAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Trattenuta ({formData.retentionPercentage}%):</span>
          <span className="text-sm font-bold text-red-600">-€{(grossAmount * formData.retentionPercentage / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center border-t pt-2">
          <span className="text-sm font-medium text-gray-700">Importo Netto:</span>
          <span className="text-lg font-bold text-green-600">€{netAmount.toFixed(2)}</span>
        </div>
        
        {/* Meal Summary */}
        {(formData.companyMeal || formData.mealVoucher) && (
          <div className="border-t border-gray-200 pt-2 mt-2">
            {formData.companyMeal && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-orange-700">Pasto Aziendale:</span>
                <span className="text-sm font-medium text-orange-700">-€10.00</span>
              </div>
            )}
            {formData.mealVoucher && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-yellow-700">Buono Pasto:</span>
                <span className="text-sm font-medium text-yellow-700">+€7.50</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Annulla
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Salva
        </button>
      </div>
    </form>
  );
};

function calculateTotalHours(startTime: string, endTime: string, breakTime: number): number {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, diffHours - (breakTime / 60));
}

export default TimesheetModal;