import React, { useState } from 'react';
import { QrCode, MapPin, Building2, Calendar } from 'lucide-react';
import WarehouseCheckIn from './CheckIn/WarehouseCheckIn';
import EventCheckIn from './CheckIn/EventCheckIn';
import { CopyrightFooter } from '../UI/CopyrightFooter';

const MobileCheckIn: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'warehouse' | 'event'>('warehouse');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Check-in Mobile</h1>
            <p className="text-gray-300">Scegli il tipo di check-in</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300">
              {new Date().toLocaleDateString('it-IT')}
            </div>
            <div className="text-xs text-gray-400">
              {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Section Selector */}
        <div className="bg-gray-800 rounded-xl p-2 border border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveSection('warehouse')}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all ${
                activeSection === 'warehouse'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <QrCode className="h-5 w-5" />
              <span className="font-medium">Turni</span>
            </button>
            
            <button
              onClick={() => setActiveSection('event')}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-all ${
                activeSection === 'event'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <MapPin className="h-5 w-5" />
              <span className="font-medium">Eventi</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeSection === 'warehouse' ? (
            <WarehouseCheckIn />
          ) : (
            <EventCheckIn />
          )}
        </div>

        {/* Copyright */}
        <CopyrightFooter />
      </div>
    </div>
  );
};

export default MobileCheckIn;