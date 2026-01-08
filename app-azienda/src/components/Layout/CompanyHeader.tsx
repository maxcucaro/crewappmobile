import React from 'react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { Building2, LogOut } from 'lucide-react';

export const CompanyHeader: React.FC = () => {
  const { companyProfile, signOut } = useCompanyAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Errore logout:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{companyProfile?.nome_azienda}</h1>
            <p className="text-sm text-gray-600">Pannello di Gestione</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Esci</span>
        </button>
      </div>
    </header>
  );
};
