import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Settings, Users, AlertTriangle, CheckCircle, X, Building2 } from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import { PrivacyField } from '../../types/privacy';

interface Company {
  id: string;
  name: string;
  email: string;
  hasWorkedWith: boolean;
  lastEventDate?: string;
}

const PrivacyManagement: React.FC = () => {
  const { user } = useAuth();
  const {
    crewPrivacySettings,
    addCrewPrivacy,
    updateCrewPrivacy,
    hideFromCompany,
    unhideFromCompany,
    getHiddenFieldsForCompany
  } = usePrivacy();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showFieldsModal, setShowFieldsModal] = useState(false);

  // Carica le aziende reali dal database
  React.useEffect(() => {
    if (user?.id) {
      loadUserProfile();
      loadCompaniesFromDatabase();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    try {
      // Carica i dati del profilo dalla tabella registration_requests
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (userError) {
        console.error('Errore nel caricamento profilo:', userError);
        setProfile(null);
        return;
      }

      // Carica informazioni azienda se è un dipendente
      let companyInfo = undefined;
      if (userData.parent_company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('regaziendasoftware')
          .select('id, ragione_sociale, email, telefono')
          .eq('id', userData.parent_company_id)
          .single();
        
        if (!companyError && companyData) {
          companyInfo = {
            id: companyData.id,
            name: companyData.ragione_sociale,
            email: companyData.email,
            phone: companyData.telefono
          };
        }
      }

      setProfile({ companyInfo });
    } catch (error) {
      console.error('Errore nel caricamento profilo:', error);
      setProfile(null);
    }
  };

  const loadCompaniesFromDatabase = async () => {
    try {
      setLoading(true);
      
      // Prima trova l'ID del software "crew"
      const { data: crewSoftware, error: softwareError } = await supabase
        .from('listasoftware')
        .select('id')
        .eq('codice', 'crew_manager')
        .maybeSingle();
      
      if (softwareError) {
        console.error('Errore nella query software crew_manager:', softwareError);
        setCompanies([]);
        return;
      }
      
      if (!crewSoftware) {
        console.warn('Software crew_manager non trovato nel database');
        setCompanies([]);
        return;
      }
      
      // Carica solo le aziende che hanno il software crew_manager attivo
      const { data: companiesData, error: companiesError } = await supabase
        .from('azienda_software')
        .select(`
          azienda_id,
          regaziendasoftware!azienda_id(
            id,
            ragione_sociale,
            email,
            telefono,
            attivo
          )
        `)
        .eq('software_id', crewSoftware.id)
        .eq('stato', 'attivo')
        .order('ragione_sociale', { foreignTable: 'regaziendasoftware', ascending: true });
      
      if (companiesError) {
        console.error('Errore nel caricamento aziende:', companiesError);
        setCompanies([]);
        return;
      }
      
      // Carica gli eventi a cui questo crew ha partecipato per determinare con chi ha lavorato
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('event_crew_assignments')
        .select(`
          event_id,
          events!event_id(
            company_id,
            start_date,
            title,
            regaziendasoftware!company_id(ragione_sociale)
          )
        `)
        .eq('crew_id', user?.id);
      
      // Crea mappa delle aziende con cui ha lavorato
      const workedWithMap = new Map<string, { hasWorked: boolean; lastEventDate?: string }>();
      
      if (!assignmentsError && assignmentsData) {
        assignmentsData.forEach(assignment => {
          const event = assignment.events;
          if (event && event.company_id) {
            const existing = workedWithMap.get(event.company_id);
            const eventDate = event.start_date;
            
            if (!existing || (eventDate && (!existing.lastEventDate || eventDate > existing.lastEventDate))) {
              workedWithMap.set(event.company_id, {
                hasWorked: true,
                lastEventDate: eventDate
              });
            }
          }
        });
      }
      
      // Mappa le aziende al formato Company
      const mappedCompanies: Company[] = (companiesData || [])
        .filter(item => item.regaziendasoftware && item.regaziendasoftware.attivo)
        .map(item => {
        const company = item.regaziendasoftware;
        const workInfo = workedWithMap.get(company.id);
        
        return {
          id: company.id,
          name: company.ragione_sociale,
          email: company.email,
          hasWorkedWith: workInfo?.hasWorked || false,
          lastEventDate: workInfo?.lastEventDate
        };
      });
      
      setCompanies(mappedCompanies);
      
    } catch (error) {
      console.error('Errore nel caricamento aziende:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const currentPrivacy = crewPrivacySettings.find(p => p.crewId === user?.id);

  // Se non ci sono impostazioni privacy per questo utente, creale di default
  React.useEffect(() => {
    if (user?.id && !currentPrivacy) {
      const defaultPrivacy: CrewPrivacySettings = {
        crewId: user.id,
        isPublicProfile: true,
        hiddenFromCompanies: [],
        hiddenFields: {}
      };
      
      addCrewPrivacy(defaultPrivacy);
    }
  }, [user?.id, currentPrivacy, addCrewPrivacy]);

  const userPrivacy = crewPrivacySettings.find(p => p.crewId === user?.id);

  const privacyFields: { field: PrivacyField; label: string; description: string }[] = [
    { field: 'hourlyRate', label: 'Tariffa Oraria', description: 'La tua tariffa base per ora' },
    { field: 'experience', label: 'Anni di Esperienza', description: 'I tuoi anni di esperienza nel settore' },
    { field: 'phone', label: 'Numero di Telefono', description: 'Il tuo numero di telefono personale' },
    { field: 'address', label: 'Indirizzo', description: 'Il tuo indirizzo di residenza' },
    { field: 'skills', label: 'Competenze', description: 'La lista delle tue competenze tecniche' },
    { field: 'bio', label: 'Biografia', description: 'La tua descrizione professionale' },
    { field: 'availability', label: 'Disponibilità', description: 'I tuoi giorni di disponibilità settimanale' },
    { field: 'enpalsStatus', label: 'Status ENPALS', description: 'Lo stato della tua agibilità ENPALS' },
    { field: 'rating', label: 'Valutazioni', description: 'Le tue valutazioni e recensioni' },
    { field: 'eventsHistory', label: 'Storico Eventi', description: 'La cronologia dei tuoi eventi passati' }
  ];

  const handleTogglePublicProfile = () => {
    if (!user?.id || !currentPrivacy) return;
    
    updateCrewPrivacy(user.id, {
      isPublicProfile: !currentPrivacy.isPublicProfile
    });
  };

  const handleToggleCompanyVisibility = (companyId: string) => {
    if (!user?.id || !currentPrivacy) return;

    const isCurrentlyHidden = currentPrivacy.hiddenFromCompanies.includes(companyId);
    
    if (isCurrentlyHidden) {
      unhideFromCompany(user.id, companyId);
    } else {
      // Show modal to select which fields to hide
      const company = companies.find(c => c.id === companyId);
      setSelectedCompany(company || null);
      setShowFieldsModal(true);
    }
  };

  const handleSaveFieldsSelection = (selectedFields: PrivacyField[]) => {
    if (!user?.id || !selectedCompany) return;

    if (selectedFields.length === 0) {
      // If no fields selected, unhide completely
      unhideFromCompany(user.id, selectedCompany.id);
    } else {
      // Hide with selected fields
      hideFromCompany(user.id, selectedCompany.id, selectedFields);
    }

    setShowFieldsModal(false);
    setSelectedCompany(null);
  };

  const isCompanyHidden = (companyId: string): boolean => {
    return currentPrivacy?.hiddenFromCompanies.includes(companyId) || false;
  };

  const getHiddenFieldsCount = (companyId: string): number => {
    if (!user?.id) return 0;
    return getHiddenFieldsForCompany(user.id, companyId).length;
  };

  const visibleCompaniesCount = companies.length - (userPrivacy?.hiddenFromCompanies.length || 0);
  const totalHiddenFields = Object.values(userPrivacy?.hiddenFields || {}).reduce((sum, fields) => sum + fields.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userPrivacy) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Impostazioni Privacy</h2>
        <p className="text-gray-600">Inizializzazione delle impostazioni privacy...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestione Privacy</h1>
        <p className="text-gray-600">Controlla chi può vedere le tue informazioni e cosa possono vedere</p>
      </div>

      {/* Privacy Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className={`${currentPrivacy.isPublicProfile ? 'bg-green-500' : 'bg-red-500'} p-3 rounded-lg`}>
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Profilo</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentPrivacy.isPublicProfile ? 'Pubblico' : 'Privato'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aziende Visibili</p>
              <p className="text-2xl font-bold text-gray-900">{visibleCompaniesCount}/{companies.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-orange-500 p-3 rounded-lg">
              <EyeOff className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aziende Bloccate</p>
              <p className="text-2xl font-bold text-gray-900">{currentPrivacy.hiddenFromCompanies.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Campi Nascosti</p>
              <p className="text-2xl font-bold text-gray-900">{totalHiddenFields}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Privacy Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Impostazioni Generali</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Profilo Pubblico</h4>
              <p className="text-sm text-gray-600">
                {userPrivacy.isPublicProfile 
                  ? 'Il tuo profilo è visibile a tutte le aziende (eccetto quelle bloccate)'
                  : 'Il tuo profilo è completamente privato e non visibile a nessuna azienda'
                }
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={userPrivacy.isPublicProfile}
                onChange={handleTogglePublicProfile}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {!userPrivacy.isPublicProfile && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-900">Profilo Privato Attivo</h4>
                  <p className="text-sm text-red-700">
                    Con il profilo privato, nessuna azienda può vedere le tue informazioni o contattarti per nuovi eventi.
                    Puoi comunque lavorare con aziende che ti hanno già assegnato a eventi in corso.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company-Specific Privacy */}
      {userPrivacy.isPublicProfile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy per Azienda</h3>
          {companies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nessuna azienda disponibile</p>
              <p className="text-sm mt-1">Non ci sono aziende registrate nel sistema</p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                Controlla la visibilità del tuo profilo per ogni azienda. Puoi nascondere tutto il profilo o solo specifiche informazioni.
              </p>
          
              <div className="space-y-4">
                {companies.map((company) => {
                  const isHidden = isCompanyHidden(company.id);
                  const hiddenFieldsCount = getHiddenFieldsCount(company.id);
                 const isOwnCompany = profile?.companyInfo?.id === company.id;
              
                  return (
                    <React.Fragment key={company.id}>
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${isHidden ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        <div>
                          <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                            <Building2 className="h-4 w-4" />
                            <span>{company.name}</span>
                            {company.hasWorkedWith && (
                              <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Collaborato
                              </span>
                            )}
                           {isOwnCompany && (
                             <span className="inline-flex px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                               La Mia Azienda
                             </span>
                           )}
                          </h4>
                          <p className="text-sm text-gray-500">{company.email}</p>
                          {company.hasWorkedWith && company.lastEventDate && (
                            <p className="text-xs text-gray-400">
                              Ultimo evento: {new Date(company.lastEventDate).toLocaleDateString('it-IT')}
                            </p>
                          )}
                          {isHidden && hiddenFieldsCount > 0 && (
                            <p className="text-xs text-orange-600 mt-1">
                              {hiddenFieldsCount} campi nascosti
                            </p>
                          )}
                         {isOwnCompany && (
                           <p className="text-xs text-purple-600 mt-1">
                             Non puoi nasconderti dalla tua azienda di appartenenza
                           </p>
                         )}
                        </div>
                      </div>
                        
                        <div className="flex items-center space-x-3">
                       {isOwnCompany ? (
                         <div className="flex items-center space-x-2">
                           <span className="text-sm text-purple-600 font-medium">Sempre Visibile</span>
                           <button
                             disabled
                             className="bg-gray-300 text-gray-500 px-3 py-1 rounded text-sm cursor-not-allowed"
                           >
                             Bloccato
                           </button>
                         </div>
                       ) : isHidden ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-red-600 font-medium">Nascosto</span>
                              <button
                                onClick={() => handleToggleCompanyVisibility(company.id)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                              >
                                Mostra
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-green-600 font-medium">Visibile</span>
                              <button
                                onClick={() => handleToggleCompanyVisibility(company.id)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                              >
                                Nascondi
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>

      {/* Privacy Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Consigli per la Privacy</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Profilo Pubblico:</strong> Massimizza le opportunità di lavoro ma mantieni il controllo</li>
              <li>• <strong>Nascondi Selettivamente:</strong> Puoi nascondere solo alcune informazioni invece di tutto il profilo</li>
              <li>• <strong>Storico Collaborazioni:</strong> Le aziende con cui hai già lavorato possono sempre vedere le informazioni degli eventi passati</li>
              <li>• <strong>Notifiche:</strong> Riceverai sempre notifiche quando cambi le impostazioni privacy</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Fields Selection Modal */}
      {showFieldsModal && selectedCompany && (
        <FieldsSelectionModal
          company={selectedCompany}
          availableFields={privacyFields}
          currentHiddenFields={getHiddenFieldsForCompany(user?.id || '', selectedCompany.id)}
          onSave={handleSaveFieldsSelection}
          onClose={() => {
            setShowFieldsModal(false);
            setSelectedCompany(null);
          }}
        />
      )}
    </div>
  );
};

// Fields Selection Modal Component
interface FieldsSelectionModalProps {
  company: Company;
  availableFields: { field: PrivacyField; label: string; description: string }[];
  currentHiddenFields: PrivacyField[];
  onSave: (selectedFields: PrivacyField[]) => void;
  onClose: () => void;
}

const FieldsSelectionModal: React.FC<FieldsSelectionModalProps> = ({
  company,
  availableFields,
  currentHiddenFields,
  onSave,
  onClose
}) => {
  const [selectedFields, setSelectedFields] = useState<PrivacyField[]>(currentHiddenFields);

  const handleFieldToggle = (field: PrivacyField) => {
    setSelectedFields(prev => 
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleSave = () => {
    onSave(selectedFields);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Seleziona Campi da Nascondere - {company.name}
          </h3>
          
          <div className="mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <h4 className="font-medium text-yellow-900">Controllo Granulare</h4>
                  <p className="text-sm text-yellow-800">
                    Seleziona quali informazioni nascondere a <strong>{company.name}</strong>. 
                    Se non selezioni nessun campo, il tuo profilo sarà completamente visibile.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableFields.map((fieldInfo) => (
              <label key={fieldInfo.field} className="flex items-start space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(fieldInfo.field)}
                  onChange={() => handleFieldToggle(fieldInfo.field)}
                  className="mt-1 rounded border-gray-300"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{fieldInfo.label}</div>
                  <div className="text-sm text-gray-600">{fieldInfo.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Riepilogo</h4>
                <p className="text-sm text-gray-600">
                  {selectedFields.length === 0 
                    ? 'Profilo completamente visibile'
                    : `${selectedFields.length} campi nascosti`
                  }
                </p>
              </div>
              <div className="text-right">
                <div className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  selectedFields.length === 0 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {selectedFields.length === 0 ? 'Visibile' : 'Parzialmente Nascosto'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Salva Impostazioni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyManagement;