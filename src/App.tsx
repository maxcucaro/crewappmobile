import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { ToastProvider, useToastContext } from './context/ToastContext';
import ToastContainer from './components/UI/ToastContainer';
import UpdatePrompt from './components/UI/UpdatePrompt';
import { useVersionManager } from './hooks/useVersionManager';
import LandingPage from './components/Landing/LandingPage';
import LoginForm from './components/Auth/LoginForm';
import RegistrationForm from './components/Auth/RegistrationForm';
import PasswordChangeModal from './components/Auth/PasswordChangeModal';
import MobileHeader from './components/Mobile/MobileHeader';
import MobileNavigation from './components/Mobile/MobileNavigation';

// Mobile Components
import MobileDashboard from './components/Mobile/MobileDashboard';
import MobileCalendar from './components/Mobile/MobileCalendar';
import MobileCheckIn from './components/Mobile/MobileCheckIn';
import MobileProfile from './components/Mobile/MobileProfile';
import MobileReport from './components/Mobile/MobileReport';
import CompanyTalk from './components/Mobile/CompanyTalk';
// NOTE: switched expenses tab to render RequestsManagement (centralized requests & expenses)
import RequestsManagement from './components/Mobile/RequestsManagement';

// Company App Components
import CompanyApp from '../app-azienda/src/App';

const AppContent: React.FC = () => {
  const { user, loading, isFirstAccess } = useAuth();
  const { toasts, removeToast, showInfo } = useToastContext();
  const {
    currentVersion,
    latestVersion,
    releaseNotes,
    hasUpdate,
    isLoading: versionLoading,
    isUpdating,
    checkForUpdates,
    applyUpdate
  } = useVersionManager();
  
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [showLanding, setShowLanding] = React.useState(true);
  const [showUpdatePrompt, setShowUpdatePrompt] = React.useState(false);

  React.useEffect(() => {
    if (isFirstAccess && user) {
      setShowPasswordModal(true);
    }
  }, [isFirstAccess, user]);

  // Gestione aggiornamenti
  React.useEffect(() => {
    if (hasUpdate && !showUpdatePrompt) {
      setShowUpdatePrompt(true);
      showInfo(
        'Aggiornamento Disponibile',
        `Nuova versione ${latestVersion} disponibile. Tocca per aggiornare.`,
        10000
      );
    }
  }, [hasUpdate, showUpdatePrompt, latestVersion, showInfo]);

  const handleUpdateApp = async () => {
    setShowUpdatePrompt(false);
    showInfo('Aggiornamento in corso...', 'L\'app si riavvierà automaticamente', 3000);
    await applyUpdate();
  };

  const handleDismissUpdate = () => {
    setShowUpdatePrompt(false);
    showInfo('Aggiornamento rimandato', 'Puoi aggiornare in qualsiasi momento dal menu', 5000);
  };

  const handleCheckUpdate = async () => {
    const updateAvailable = await checkForUpdates(true);
    if (updateAvailable) {
      setShowUpdatePrompt(true);
    } else {
      showInfo('App Aggiornata', 'Stai già usando l\'ultima versione disponibile', 3000);
    }
  };

  // Show landing page first
  if (showLanding && !user) {
    return (
      <div className="min-h-screen">
        <LandingPage onEnter={() => setShowLanding(false)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Router>
          <Routes>
            <Route path="/register" element={<RegistrationForm />} />
            <Route path="/azienda/*" element={<CompanyApp />} />
            <Route path="*" element={<LoginForm />} />
          </Routes>
        </Router>
      </div>
    );
  }

  const renderContent = () => {
    // Funzionalità mobile per dipendenti
    switch (activeTab) {
      case 'calendar': return <MobileCalendar />;
      case 'checkin': return <MobileCheckIn />;
      // NOTE: expenses tab now renders RequestsManagement (central place for ferie/straordinari/note spese)
      case 'expenses': return <RequestsManagement />;
      case 'talk': return <CompanyTalk />;
      case 'report': return <MobileReport />;
      case 'profile': return <MobileProfile />;
      default: return <MobileDashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <MobileHeader
          currentVersion={currentVersion}
          hasUpdate={hasUpdate}
          isVersionLoading={versionLoading}
          isUpdating={isUpdating}
          onCheckUpdate={handleCheckUpdate}
        />
        <div className="flex-1 flex flex-col pb-20">
          <main className="flex-1 p-0 overflow-y-auto">
            {renderContent()}
          </main>
        </div>
        
        <MobileNavigation 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      
      {/* Update Prompt */}
      {showUpdatePrompt && hasUpdate && (
        <UpdatePrompt
          currentVersion={currentVersion}
          latestVersion={latestVersion}
          releaseNotes={releaseNotes}
          isUpdating={isUpdating}
          onUpdate={handleUpdateApp}
          onDismiss={handleDismissUpdate}
        />
      )}
      
      {showPasswordModal && (
        <PasswordChangeModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <PrivacyProvider>
          <AppContent />
        </PrivacyProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;