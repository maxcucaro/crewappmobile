import React from 'react';
import { Download, RefreshCw, X, Smartphone, CheckCircle } from 'lucide-react';

interface UpdatePromptProps {
  currentVersion: string | null;
  latestVersion: string | null;
  isUpdating: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

const UpdatePrompt: React.FC<UpdatePromptProps> = ({
  currentVersion,
  latestVersion,
  isUpdating,
  onUpdate,
  onDismiss
}) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Smartphone className="h-8 w-8 text-white" />
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Aggiornamento Disponibile
          </h3>

          {/* Version Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Versione Attuale:</span>
              <span className="text-sm font-medium text-gray-900">
                {currentVersion || 'Sconosciuta'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Nuova Versione:</span>
              <span className="text-sm font-bold text-blue-600">
                {latestVersion}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            È disponibile una nuova versione dell'app con miglioramenti e correzioni. 
            L'aggiornamento richiede solo pochi secondi.
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={onUpdate}
              disabled={isUpdating}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Aggiornamento in corso...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Aggiorna Ora</span>
                </>
              )}
            </button>

            {!isUpdating && (
              <button
                onClick={onDismiss}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors duration-200"
              >
                Più Tardi
              </button>
            )}
          </div>

          {/* Update Process Info */}
          {isUpdating && (
            <div className="mt-4 bg-blue-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Pulizia cache e download nuova versione...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;