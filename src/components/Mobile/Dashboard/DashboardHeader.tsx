import React from 'react';

interface DashboardHeaderProps {
  userProfile: any;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ userProfile }) => {
  // Estrai il nome dell'azienda dal profilo
  const companyName = userProfile?.regaziendasoftware?.ragione_sociale || 
                     userProfile?.company_name_cached || 
                     'Caricamento azienda...';

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-300">
          {userProfile?.full_name || userProfile?.company_name || 'Dipendente'}
        </p>
        <p className="text-sm text-blue-400">
          {companyName}
        </p>
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
  );
};

export default DashboardHeader;