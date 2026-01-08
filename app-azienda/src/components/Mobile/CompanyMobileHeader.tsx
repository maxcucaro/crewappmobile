import React from 'react';
import { Smartphone, LogOut, Building2 } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useVersionManager } from '../../hooks/useVersionManager';
import { useToast } from '../../context/ToastContext';
import VersionIndicator from '../UI/VersionIndicator';

const CompanyMobileHeader: React.FC = () => {
  const { signOut, user } = useCompanyAuth();
  const [showMenu, setShowMenu] = React.useState(false);
  const { showSuccess, showInfo } = useToast();
  const {
    currentVersion,
    hasUpdate,
    isLoading,
    isUpdating,
    checkForUpdates,
    applyUpdate
  } = useVersionManager();

  const handleCheckUpdate = async () => {
    if (hasUpdate) {
      showInfo('Aggiornamento in corso...');
      await applyUpdate();
    } else {
      const hasNewUpdate = await checkForUpdates(true);
      if (hasNewUpdate) {
        showInfo('Aggiornamento disponibile! Clicca nuovamente per aggiornare.');
      } else {
        showSuccess('Stai usando la versione piu recente!');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      showSuccess('Logout effettuato con successo');
    } catch (error) {
      console.error('Errore logout:', error);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 shadow-lg">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">CREW MANAGER</h1>
              <p className="text-xs text-gray-400">Pannello Azienda</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <VersionIndicator
              currentVersion={currentVersion}
              hasUpdate={hasUpdate}
              isLoading={isLoading}
              isUpdating={isUpdating}
              onCheckUpdate={handleCheckUpdate}
            />

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Smartphone className="w-6 h-6" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                    <div className="p-4 border-b border-gray-700">
                      <p className="text-sm text-gray-400">Accesso come:</p>
                      <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Esci</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default CompanyMobileHeader;
