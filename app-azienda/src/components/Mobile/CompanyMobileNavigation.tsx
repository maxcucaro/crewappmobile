import React from 'react';
import { FileText, Clock, User, Home, Calendar, Users, MessageCircle, Activity, BookOpen } from 'lucide-react';

interface CompanyMobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const CompanyMobileNavigation: React.FC<CompanyMobileNavigationProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: Home,
      description: 'Dashboard principale'
    },
    {
      id: 'checkin',
      label: 'Check-In',
      icon: Activity,
      description: 'Monitor presenze'
    },
    {
      id: 'events',
      label: 'Eventi',
      icon: Users,
      description: 'Assegna crew agli eventi'
    },
    {
      id: 'courses',
      label: 'Corsi',
      icon: BookOpen,
      description: 'Gestione corsi'
    },
    {
      id: 'shifts',
      label: 'Turni',
      icon: Clock,
      description: 'Gestione turni'
    },
    {
      id: 'calendar',
      label: 'Calendario',
      icon: Calendar,
      description: 'I miei eventi'
    },
    {
      id: 'expenses',
      label: 'Richieste',
      icon: FileText,
      description: 'Richieste e Rimborsi'
    },
    {
      id: 'talk',
      label: 'Talk',
      icon: MessageCircle,
      description: 'Talk'
    },
    {
      id: 'profile',
      label: 'Profilo',
      icon: User,
      description: 'Il mio profilo'
    }
  ];

  return (
    <>
      <style>{`
        @keyframes pulse-red {
          0%, 100% {
            background-color: rgb(220, 38, 38);
            box-shadow: 0 0 10px rgba(220, 38, 38, 0.5);
          }
          50% {
            background-color: rgb(185, 28, 28);
            box-shadow: 0 0 20px rgba(220, 38, 38, 0.8);
          }
        }
        .animate-pulse-red {
          animation: pulse-red 1s ease-in-out infinite;
        }
      `}</style>

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
              const isTalk = item.id === 'talk';

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex flex-col items-center space-y-0.5 px-4 py-1.5 rounded-lg transition-all duration-200 flex-shrink-0 w-[85px] snap-center ${
                    isTalk
                      ? 'animate-pulse-red text-white shadow-lg'
                      : isActive
                      ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={item.description}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive || isTalk ? 'text-white' : ''}`} />
                  <span className={`text-[10px] font-medium leading-tight text-center ${isActive || isTalk ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && !isTalk && (
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
    </>
  );
};

export default CompanyMobileNavigation;
