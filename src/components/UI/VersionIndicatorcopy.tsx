import React from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Download } from 'lucide-react';

interface VersionIndicatorProps {
  currentVersion: string | null;
  hasUpdate: boolean;
  isLoading: boolean;
  isUpdating: boolean;
  onCheckUpdate: () => void;
}

const VersionIndicator: React.FC<VersionIndicatorProps> = ({
  currentVersion,
  hasUpdate,
  isLoading,
  isUpdating,
  onCheckUpdate
}) => {
  const getStatusIcon = () => {
    if (isUpdating) return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />;
    if (hasUpdate) return <Download className="h-4 w-4 text-orange-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isUpdating) return 'Aggiornamento...';
    if (isLoading) return 'Controllo...';
    if (hasUpdate) return 'Aggiornamento disponibile';
    return 'Aggiornato';
  };

  const getStatusColor = () => {
    if (isUpdating) return 'text-blue-600';
    if (isLoading) return 'text-gray-500';
    if (hasUpdate) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <button
      onClick={onCheckUpdate}
      disabled={isLoading || isUpdating}
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
        hasUpdate 
          ? 'bg-orange-100 hover:bg-orange-200 text-orange-800' 
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={`Versione ${currentVersion || 'Sconosciuta'} - ${getStatusText()}`}
    >
      {getStatusIcon()}
      <div className="text-left">
        <div className="text-xs font-medium">v{currentVersion || '?'}</div>
        <div className={`text-xs ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>
    </button>
  );
};

export default VersionIndicator;