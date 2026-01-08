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

  const title = `Versione ${currentVersion || 'Sconosciuta'} - ${getStatusText()}`;

  return (
    <>
      {/* Compact button for small screens */}
      <button
        onClick={onCheckUpdate}
        disabled={isLoading || isUpdating}
        className={`sm:hidden inline-flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs
          ${hasUpdate ? 'bg-orange-100 hover:bg-orange-200 text-orange-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
          disabled:opacity-50 disabled:cursor-not-allowed`}
        title={title}
        aria-label={title}
        type="button"
      >
        {getStatusIcon()}
        <span className="font-medium text-[11px]">v{currentVersion || '?'}</span>
      </button>

      {/* Full pill for larger screens (compact) */}
      <button
        onClick={onCheckUpdate}
        disabled={isLoading || isUpdating}
        className={`hidden sm:flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors ${
          hasUpdate
            ? 'bg-orange-100 hover:bg-orange-200 text-orange-800'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={title}
        type="button"
      >
        <div className="scale-75">{getStatusIcon()}</div>
        <div className="text-left">
          <div className="text-[10px] font-medium leading-tight">v{currentVersion || '?'}</div>
          <div className={`text-[9px] leading-tight ${getStatusColor()}`}>
            {getStatusText()}
          </div>
        </div>
      </button>
    </>
  );
};

export default VersionIndicator;