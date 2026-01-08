import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Users, 
  Calendar, 
  FileText, 
  Settings,
  Clock,
  Shield,
  Download,
  FolderOpen,
  QrCode,
  ChevronRight,
  ChevronLeft,
  X,
  GraduationCap,
  AlertTriangle,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobileDevice(isMobile);
      
      // Auto-collapse sidebar on small screens
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const getMenuItems = () => {
    // Solo menu crew
    return [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'profile', label: 'Il Mio Profilo', icon: Users },
      { id: 'privacy', label: 'Privacy', icon: Shield },
      { id: 'calendar', label: 'Il Mio Calendario', icon: Calendar },
      { id: 'vacation-requests', label: 'Ferie e Permessi', icon: Calendar },
      { id: 'timesheet', label: 'Timesheet', icon: Clock },
      { id: 'overtime-history', label: 'Straordinari', icon: Clock },
      { id: 'training-history', label: 'Corsi Formazione', icon: GraduationCap },
      { id: 'expenses', label: 'Note Spese', icon: FileText },
      { id: 'documents', label: 'I Miei Documenti', icon: FolderOpen },
      { id: 'warehouse-checkin', label: 'Check-in Magazzino', icon: QrCode },
    ];
  };

  const menuItems = getMenuItems();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const handleItemClick = (tabId: string) => {
    onTabChange(tabId);
    if (isMobileDevice) {
      setShowMobileSidebar(false);
    }
  };

  // Mobile sidebar
  if (isMobileDevice) {
    return (
      <>
        {/* Mobile Sidebar Toggle Button */}
        <button
          onClick={toggleMobileSidebar}
          className="fixed bottom-6 left-6 z-10 w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center shadow-lg md:hidden"
        >
          {showMobileSidebar ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Menu className="h-6 w-6 text-white" />
          )}
        </button>
        
        {/* Mobile Sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 flex">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75"
              onClick={toggleMobileSidebar}
            ></div>
            
            {/* Sidebar */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-gray-900">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  onClick={toggleMobileSidebar}
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>
              
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4">
                  <h1 className="text-xl font-bold text-white">CrewCheck</h1>
                </div>
                <nav className="mt-5 px-2 space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`group flex items-center px-2 py-3 text-base font-medium rounded-md w-full text-left ${
                          activeTab === item.id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <Icon className="mr-4 h-6 w-6" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
                
                {/* Copyright */}
                <div className="px-4 py-4 mt-auto border-t border-gray-700">
                  <p className="text-xs text-gray-400 text-center">
                    © 2025 CrewCheck. Tutti i diritti riservati.
                  </p>
                </div>
              </div>
              <h1 className="text-xl font-bold">
                Crew Manager <span className="text-blue-400 italic font-extrabold tracking-wider transform -skew-x-12 inline-block text-lg">Staff</span>
              </h1>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className={`bg-gray-900 text-white ${collapsed ? 'w-20' : 'w-64'} min-h-screen transition-all duration-300 relative flex flex-col`}>
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 bg-gray-900 text-white p-1 rounded-full shadow-md"
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
      
      <div className="p-4 flex-grow">
        {!collapsed && (
          <div className="mb-6 px-2">
            <h1 className="text-xl font-bold">ControlStage</h1>
          </div>
        )}
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md text-left transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Copyright */}
      <div className={`p-4 ${collapsed ? 'text-center' : ''} mt-auto border-t border-gray-700`}>
        <p className={`text-xs text-gray-400 ${collapsed ? 'text-center' : ''}`}>
          {collapsed ? '© 2025' : '© 2025 ControlStage. Tutti i diritti riservati. Software V. 1.0.0'}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;