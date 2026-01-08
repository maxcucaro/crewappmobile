import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToast } from '../../context/ToastContext';
import { Warehouse, MapPin, Phone } from 'lucide-react';

interface WarehouseType {
  id: string;
  nome_magazzino: string;
  indirizzo: string;
  citta: string;
  cap: string;
  telefono: string | null;
  created_at: string;
}

export const WarehousesView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { addToast } = useToast();
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWarehouses();
  }, [companyProfile]);

  const loadWarehouses = async () => {
    if (!companyProfile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('magazzini')
        .select('*')
        .eq('azienda_id', companyProfile.id)
        .order('nome_magazzino', { ascending: true });

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error: any) {
      addToast(error.message || 'Errore nel caricamento magazzini', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Magazzini e Sedi</h2>
        <p className="text-gray-600 mt-1">Gestisci le tue sedi operative</p>
      </div>

      {warehouses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Nessun magazzino configurato
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
                  <Warehouse className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-3 truncate">
                    {warehouse.nome_magazzino}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{warehouse.indirizzo}</p>
                        <p>
                          {warehouse.citta}, {warehouse.cap}
                        </p>
                      </div>
                    </div>
                    {warehouse.telefono && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{warehouse.telefono}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
