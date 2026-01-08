import React from 'react';
import { QrCode, FileText, Clock, User, Home, Calendar, MessageSquare } from 'lucide-react';

interface MobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Home', 
      icon: Home,
      description: 'Dashboard principale'
    },
    { 
      id: 'calendar', 
      label: 'Calendario', 
      icon: Calendar,
      description: 'I miei eventi'
    },
    { 
      id: 'checkin', 
      label: 'Check-in', 
      icon: QrCode,
      description: 'QR Code e GPS'
    },
    {
      id: 'expenses',
      label: 'Richieste',
      icon: FileText,
      description: 'Richieste e Rimborsi'
    },
    {
      id: 'talk',
      label: 'Messaggi',
      icon: MessageSquare,
      description: 'Messaggi azienda'
    },
    {
      id: 'report',
      label: 'Report',
      icon: Clock,
      description: 'Report mensile'
    },
    { 
      id: 'profile', 
      label: 'Profilo', 
      icon: User,
      description: 'Il mio profilo'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50 shadow-lg pb-safe">
      <div className="relative max-w-screen-lg mx-auto">
        <div
          className="flex items-center gap-2 px-2 py-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center space-y-0.5 px-4 py-1.5 rounded-lg transition-all duration-200 flex-shrink-0 w-[85px] snap-center ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title={item.description}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                <span className={`text-[10px] font-medium leading-tight text-center ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-gray-800 to-transparent pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-gray-800 to-transparent pointer-events-none"></div>
      </div>
    </nav>
  );
};

export default MobileNavigation;