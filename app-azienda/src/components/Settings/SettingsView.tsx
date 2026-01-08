import React from 'react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { Building2, Mail, Phone, MapPin } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();

  if (!companyProfile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Impostazioni Azienda</h2>
        <p className="text-gray-600 mt-1">Visualizza le informazioni aziendali</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-blue-600 p-4 rounded-xl">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{companyProfile.nome_azienda}</h3>
            <p className="text-sm text-gray-600">P.IVA: {companyProfile.partita_iva}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-400" />
              <span className="text-gray-900">{companyProfile.email}</span>
            </div>
          </div>

          {companyProfile.telefono && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">{companyProfile.telefono}</span>
              </div>
            </div>
          )}

          {companyProfile.indirizzo && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo</label>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">
                  {companyProfile.indirizzo}
                  {companyProfile.citta && `, ${companyProfile.citta}`}
                  {companyProfile.cap && ` ${companyProfile.cap}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-2">Informazioni</h4>
        <p className="text-sm text-blue-800">
          Per modificare le informazioni aziendali, contatta l'amministratore di sistema.
        </p>
      </div>
    </div>
  );
};
