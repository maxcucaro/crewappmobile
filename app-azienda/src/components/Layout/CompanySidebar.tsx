import React from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Calendar,
  FileText,
  Warehouse,
  BookOpen,
  Settings
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const CompanySidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Dipendenti', icon: Users },
    { id: 'courses', label: 'Corsi', icon: BookOpen },
    { id: 'requests', label: 'Richieste', icon: ClipboardCheck },
    { id: 'shifts', label: 'Turni', icon: Calendar },
    { id: 'reports', label: 'Report', icon: FileText },
    { id: 'warehouses', label: 'Magazzini', icon: Warehouse },
    { id: 'settings', label: 'Impostazioni', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
