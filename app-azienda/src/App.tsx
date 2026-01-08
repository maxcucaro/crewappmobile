import React from 'react';
import { CompanyAuthProvider, useCompanyAuth } from './context/CompanyAuthContext';
import { ToastProvider, useToastContext } from './context/ToastContext';
import ToastContainer from './components/UI/ToastContainer';
import { CompanyLogin } from './components/Auth/CompanyLogin';
import CompanyMobileHeader from './components/Mobile/CompanyMobileHeader';
import CompanyMobileNavigation from './components/Mobile/CompanyMobileNavigation';

// Mobile Components
import CompanyMobileDashboard from './components/Mobile/CompanyMobileDashboard';
import CompanyMobileCalendar from './components/Mobile/CompanyMobileCalendar';
import CompanyMobileProfile from './components/Mobile/CompanyMobileProfile';
import CompanyMobileReport from './components/Mobile/CompanyMobileReport';
import CompanyRequestsManagement from './components/Mobile/CompanyRequestsManagement';
import CompanyEventsManagement from './components/Mobile/CompanyEventsManagement';
import CompanyCheckInMonitor from './components/Mobile/CompanyCheckInMonitor';
import CompanyTalk from './components/Mobile/CompanyTalk';
import { WeeklyShiftsView } from './components/Shifts/WeeklyShiftsView';
import { CoursesView } from './components/Courses/CoursesView';

const AppContent: React.FC = () => {
  const { user, loading } = useCompanyAuth();
  const { toasts, removeToast } = useToastContext();
  const [activeTab, setActiveTab] = React.useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <CompanyLogin />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'checkin': return <CompanyCheckInMonitor />;
      case 'events': return <CompanyEventsManagement />;
      case 'courses': return <CoursesView />;
      case 'shifts': return (
        <div className="p-4">
          <WeeklyShiftsView />
        </div>
      );
      case 'calendar': return <CompanyMobileCalendar />;
      case 'expenses': return <CompanyRequestsManagement />;
      case 'report': return <CompanyMobileReport />;
      case 'talk': return <CompanyTalk />;
      case 'profile': return <CompanyMobileProfile />;
      default: return <CompanyMobileDashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <CompanyMobileHeader />
      <div className="flex-1 flex flex-col pb-20">
        <main className="flex-1 p-0 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      <CompanyMobileNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

const CompanyApp: React.FC = () => {
  return (
    <ToastProvider>
      <CompanyAuthProvider>
        <AppContent />
      </CompanyAuthProvider>
    </ToastProvider>
  );
};

export default CompanyApp;
