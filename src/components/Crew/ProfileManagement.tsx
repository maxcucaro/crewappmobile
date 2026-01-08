import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Star, Calendar, Edit, Save, X, AlertTriangle, CheckCircle, Clock, Building2, DollarSign, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';

interface CrewProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  profileType: 'freelance' | 'employee';
  companyName?: string;
  skills: string[];
  experience: number;
  hourlyRate?: number;
  bio: string;
  enpalsStatus: {
    isActive: boolean;
    expiryDate?: string;
    documentNumber?: string;
  };
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  companyInfo?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  assignedRates?: any[];
}

const ProfileManagement: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<CrewProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedProfile, setEditedProfile] = useState<CrewProfile | null>(null);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Caricamento profilo per user ID:', user?.id);

      // Prima prova a caricare da registration_requests usando l'ID corretto
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('auth_user_id', user?.id)
        .maybeSingle();

      console.log('📋 Dati registration_requests:', userData, userError);

      let profileData = null;
      let companyInfo = undefined;

      if (userError) {
        console.error('❌ Errore registration_requests:', userError);
      }

      if (userData) {
        profileData = userData;
        console.log('✅ Trovato in registration_requests:', profileData);

        // Se è un dipendente, carica info azienda
        if (profileData.parent_company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('regaziendasoftware')
            .select('id, ragione_sociale, email, telefono')
            .eq('id', profileData.parent_company_id)
            .maybeSingle();
          
          if (!companyError && companyData) {
            companyInfo = {
              id: companyData.id,
              name: companyData.ragione_sociale,
              email: companyData.email,
              phone: companyData.telefono
            };
          }
        }
      } else {
        // Se non trovato, prova crew_members
        console.log('⚠️ Non trovato in registration_requests, provo crew_members');
        const { data: crewData, error: crewError } = await supabase
          .from('crew_members')
          .select('*')
          .eq('id', user?.id)
          .maybeSingle();

        if (!crewError && crewData) {
          profileData = {
            full_name: `${crewData.first_name} ${crewData.last_name}`,
            email: user?.email,
            phone: crewData.phone,
            message: `Competenze: ${(crewData.skills || []).join(', ')}. Esperienza: ${crewData.experience || 0} anni. Bio: ${crewData.bio || ''}`,
            parent_company_id: crewData.company_id
          };
          console.log('✅ Trovato in crew_members, mappato:', profileData);
        }
      }

      if (!profileData) {
        setError('Profilo non trovato. Contatta l\'amministratore.');
        return;
      }

      // Estrai competenze e altri dati dal messaggio
      let skills: string[] = [];
      let experience = 0;
      let bio = '';
      
      if (profileData.message) {
        const competenzeMatch = profileData.message.match(/Competenze:\s*([^.]+)/);
        if (competenzeMatch) {
          skills = competenzeMatch[1].split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
        
        const esperienzaMatch = profileData.message.match(/Esperienza:\s*(\d+)\s*anni/);
        if (esperienzaMatch) {
          experience = parseInt(esperienzaMatch[1]);
        }
        
        const bioMatch = profileData.message.match(/Bio:\s*(.+?)(?:\.|$)/);
        if (bioMatch) {
          bio = bioMatch[1].trim();
        }
      }

      // Crea il profilo
      const fullName = profileData.full_name || profileData.company_name || '';
      const nameParts = fullName.split(' ');
      
      const profileObj: CrewProfile = {
        firstName: nameParts[0] || 'Nome',
        lastName: nameParts.slice(1).join(' ') || 'Cognome',
        email: profileData.email || user?.email || '',
        phone: profileData.phone || '',
        address: '',
        profileType: profileData.parent_company_id ? 'employee' : 'freelance',
        skills: skills,
        experience: experience,
        hourlyRate: undefined,
        bio: bio,
        enpalsStatus: {
          isActive: false,
          expiryDate: undefined,
          documentNumber: undefined
        },
        availability: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        },
        companyInfo,
        assignedRates: []
      };

      setProfile(profileObj);
      setEditedProfile(profileObj);

    } catch (error) {
      console.error('❌ Errore generale nel caricamento profilo:', error);
      setError(`Errore nel caricamento del profilo: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  const allSkills = [
    'Audio', 'Luci', 'Video', 'Regia', 'Streaming', 'Montaggio',
    'Allestimenti', 'Logistica', 'Coordinamento', 'Sicurezza',
    'Elettricista', 'Carpentiere', 'Grafica', 'Fotografia'
  ];

  const getDayName = (day: string) => {
    const days = {
      monday: 'Lunedì',
      tuesday: 'Martedì',
      wednesday: 'Mercoledì',
      thursday: 'Giovedì',
      friday: 'Venerdì',
      saturday: 'Sabato',
      sunday: 'Domenica'
    };
    return days[day as keyof typeof days];
  };

  const getEnpalsStatus = () => {
    if (!profile?.enpalsStatus.isActive) {
      return { status: 'inactive', label: 'Non Attiva', color: 'bg-red-100 text-red-800', icon: X };
    }

    if (profile?.enpalsStatus.expiryDate) {
      const expiryDate = new Date(profile.enpalsStatus.expiryDate);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        return { status: 'expired', label: 'Scaduta', color: 'bg-red-100 text-red-800', icon: X };
      } else if (daysUntilExpiry <= 7) {
        return { status: 'expiring', label: `Scade tra ${daysUntilExpiry} giorni`, color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
      } else {
        return { status: 'active', label: 'Attiva', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      }
    }

    return { status: 'active', label: 'Attiva', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  const enpalsInfo = getEnpalsStatus();
  const StatusIcon = enpalsInfo.icon;

  const handleSave = () => {
    if (editedProfile) {
      saveProfileToDatabase(editedProfile);
    }
  };

  const saveProfileToDatabase = async (profileData: CrewProfile) => {
    try {
      if (!user?.id) {
        alert('Errore: utente non autenticato');
        return;
      }

      const updateData = {
        full_name: `${profileData.firstName} ${profileData.lastName}`,
        email: profileData.email,
        phone: profileData.phone,
        message: `Competenze: ${profileData.skills.join(', ')}. Esperienza: ${profileData.experience} anni. Bio: ${profileData.bio}. ENPALS_Attiva: ${profileData.enpalsStatus.isActive}. ENPALS_Scadenza: ${profileData.enpalsStatus.expiryDate || ''}. ENPALS_Documento: ${profileData.enpalsStatus.documentNumber || ''}`,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('registration_requests')
        .update(updateData)
        .eq('auth_user_id', user.id);

      if (error) throw error;

      setProfile(profileData);
      setIsEditing(false);
      console.log('✅ Profilo aggiornato con successo');

    } catch (error) {
      console.error('Errore nel salvataggio profilo:', error);
      setError('Errore durante il salvataggio del profilo');
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleAddSkill = () => {
    if (newSkill && editedProfile && !editedProfile.skills.includes(newSkill)) {
      setEditedProfile({
        ...editedProfile,
        skills: [...editedProfile.skills, newSkill]
      });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (editedProfile) {
      setEditedProfile({
        ...editedProfile,
        skills: editedProfile.skills.filter(skill => skill !== skillToRemove)
      });
    }
  };

  const handleAvailabilityChange = (day: string, available: boolean) => {
    if (editedProfile) {
      setEditedProfile({
        ...editedProfile,
        availability: {
          ...editedProfile.availability,
          [day]: available
        }
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Profilo non trovato'}</p>
        <button
          onClick={() => loadUserProfile()}
          className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Il Mio Profilo</h1>
          <p className="text-gray-600">Gestisci le tue informazioni personali e professionali</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Edit className="h-5 w-5" />
            <span>Modifica Profilo</span>
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Save className="h-5 w-5" />
              <span>Salva</span>
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
            >
              <X className="h-5 w-5" />
              <span>Annulla</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-gray-600">{profile.profileType === 'employee' ? 'Dipendente' : 'Freelance'}</p>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">{profile.email}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">{profile.phone || 'Non specificato'}</span>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">{profile.address || 'Non specificato'}</span>
            </div>
          </div>

          {/* ENPALS Status */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Agibilità ENPALS</h4>
              <StatusIcon className="h-5 w-5" />
            </div>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${enpalsInfo.color}`}>
              {enpalsInfo.label}
            </span>
            {profile.enpalsStatus.expiryDate && (
              <p className="text-xs text-gray-500 mt-1">
                Scadenza: {new Date(profile.enpalsStatus.expiryDate).toLocaleDateString('it-IT')}
              </p>
            )}
            {profile.enpalsStatus.documentNumber && (
              <p className="text-xs text-gray-500">
                N°: {profile.enpalsStatus.documentNumber}
              </p>
            )}
          </div>

          {profile.hourlyRate && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-600">Tariffa Base</p>
                <p className="text-2xl font-bold text-green-600">€{profile.hourlyRate}/h</p>
                <p className="text-xs text-gray-500">Negoziabile per evento</p>
              </div>
            </div>
          )}

          {/* Company Information - Solo per dipendenti */}
          {profile.companyInfo && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-700">Azienda di Appartenenza</h4>
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">{profile.companyInfo.name}</p>
                <p className="text-xs text-blue-700">{profile.companyInfo.email}</p>
                {profile.companyInfo.phone && (
                  <p className="text-xs text-blue-700">{profile.companyInfo.phone}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Personali</h3>
            
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={editedProfile?.firstName || ''}
                    onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, firstName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={editedProfile?.lastName || ''}
                    onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, lastName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editedProfile?.email || ''}
                    onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={editedProfile?.phone || ''}
                    onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                  <input
                    type="text"
                    value={editedProfile?.address || ''}
                    onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <p className="text-sm text-gray-900">{profile.firstName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cognome</label>
                  <p className="text-sm text-gray-900">{profile.lastName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="text-sm text-gray-900">{profile.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefono</label>
                  <p className="text-sm text-gray-900">{profile.phone || 'Non specificato'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Indirizzo</label>
                  <p className="text-sm text-gray-900">{profile.address || 'Non specificato'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Professionali</h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Profilo</label>
                    <select
                      value={editedProfile?.profileType || 'employee'}
                      onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, profileType: e.target.value as 'freelance' | 'employee' })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 cursor-not-allowed"
                      disabled
                    >
                      <option value="freelance">Freelance</option>
                      <option value="employee">Dipendente</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Il tipo di profilo non può essere modificato
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anni di Esperienza</label>
                    <input
                      type="number"
                      value={editedProfile?.experience || 0}
                      onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, experience: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      min="0"
                    />
                  </div>
                </div>
                
                {/* ENPALS Status - Solo in modalità editing */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Agibilità ENPALS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editedProfile?.enpalsStatus.isActive || false}
                          onChange={(e) => editedProfile && setEditedProfile({
                            ...editedProfile,
                            enpalsStatus: {
                              ...editedProfile.enpalsStatus,
                              isActive: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">ENPALS Attiva</span>
                      </label>
                    </div>
                    
                    {editedProfile?.enpalsStatus.isActive && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Data Scadenza</label>
                          <input
                            type="date"
                            value={editedProfile?.enpalsStatus.expiryDate || ''}
                            onChange={(e) => editedProfile && setEditedProfile({
                              ...editedProfile,
                              enpalsStatus: {
                                ...editedProfile.enpalsStatus,
                                expiryDate: e.target.value
                              }
                            })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Numero Documento</label>
                          <input
                            type="text"
                            value={editedProfile?.enpalsStatus.documentNumber || ''}
                            onChange={(e) => editedProfile && setEditedProfile({
                              ...editedProfile,
                              enpalsStatus: {
                                ...editedProfile.enpalsStatus,
                                documentNumber: e.target.value
                              }
                            })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="es. EN123456789"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Biografia</label>
                  <textarea
                    value={editedProfile?.bio || ''}
                    onChange={(e) => editedProfile && setEditedProfile({ ...editedProfile, bio: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={4}
                    placeholder="Descrivi la tua esperienza professionale..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo Profilo</label>
                    <p className="text-sm text-gray-900 capitalize">{profile.profileType === 'employee' ? 'Dipendente' : 'Freelance'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Esperienza</label>
                    <p className="text-sm text-gray-900">{profile.experience} anni</p>
                  </div>
                </div>
                
                {profile.hourlyRate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tariffa Base</label>
                    <p className="text-sm text-gray-900">€{profile.hourlyRate}/h</p>
                    <p className="text-xs text-gray-500">Negoziabile per ogni evento</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Biografia</label>
                  <p className="text-sm text-gray-900">{profile.bio || 'Nessuna biografia'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Competenze</h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <select
                    value={newSkill || ''}
                    onChange={(e) => setNewSkill(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Seleziona una competenza</option>
                    {allSkills.filter(skill => !editedProfile?.skills.includes(skill)).map(skill => (
                      <option key={skill} value={skill}>{skill}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddSkill}
                    disabled={!newSkill}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    Aggiungi
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {editedProfile?.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                    >
                      {skill}
                      <button
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.skills.length === 0 ? (
                  <p className="text-sm text-gray-500">Nessuna competenza specificata</p>
                ) : (
                  profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                    >
                      {skill}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Disponibilità Settimanale</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {Object.entries(isEditing ? (editedProfile?.availability || {}) : (profile?.availability || {})).map(([day, available]) => (
                <div key={day} className="text-center">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getDayName(day)}
                  </label>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      checked={available || false}
                      onChange={(e) => handleAvailabilityChange(day, e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-medium ${
                      available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {available ? '✓' : '✗'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

export default ProfileManagement;