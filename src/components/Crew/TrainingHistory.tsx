import React, { useState } from 'react';
import { Calendar, Clock, MapPin, FileText, Download, CheckCircle, XCircle, Filter, Search, Building2, AlertTriangle, Eye, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';

interface Training {
  id: string;
  title: string;
  description: string;
  companyId: string;
  companyName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  instructor: string;
  status: 'invited' | 'registered' | 'confirmed' | 'attended' | 'no_show' | 'cancelled';
  isMandatory: boolean;
  category: 'safety' | 'technical' | 'soft_skills' | 'certification' | 'other';
  materials?: string[];
  certificateIssued?: boolean;
  certificateUrl?: string;
  invitedAt: Date;
  registeredAt?: Date;
}

interface TrainingFilter {
  status: 'all' | 'upcoming' | 'past';
  category: 'all' | 'safety' | 'technical' | 'soft_skills' | 'certification' | 'other';
  company: 'all' | string;
}

const TrainingHistory: React.FC = () => {
  const { user } = useAuth();
  
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<TrainingFilter>({
    status: 'all',
    category: 'all',
    company: 'all'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Carica i corsi reali dal database
  React.useEffect(() => {
    const loadTrainings = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Carica le iscrizioni ai corsi dalla tabella training_enrollments
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('iscrizioni_corsi')
          .select(`
            *,
            corsi_formazione!id_corso(
              id,
              titolo,
              descrizione,
              data,
              ora_inizio,
              ora_fine,
              luogo,
              istruttore,
              obbligatorio,
              categoria,
              materiali,
              id_azienda,
              regaziendasoftware!id_azienda(ragione_sociale)
            )
          `)
          .eq('id_tecnico', user.id)
          .order('data_invito', { ascending: false });
        
        if (enrollmentsError) {
          console.error('Errore nel caricamento corsi:', enrollmentsError);
          setTrainings([]);
        } else {
          // Mappa i dati dal database al formato dell'interfaccia
          const mappedTrainings: Training[] = (enrollmentsData || []).map(enrollment => {
            const course = enrollment.corsi_formazione;
            return {
              id: course.id,
              title: course.titolo,
              description: course.descrizione,
              companyId: course.id_azienda,
              companyName: course.regaziendasoftware?.ragione_sociale || 'Azienda Sconosciuta',
              date: course.data,
              startTime: course.ora_inizio,
              endTime: course.ora_fine,
              location: course.luogo,
              instructor: course.istruttore,
              status: enrollment.status,
              isMandatory: course.obbligatorio,
              category: course.categoria,
              materials: course.materials || [],
              certificateIssued: enrollment.certificato_emesso,
              certificateUrl: enrollment.url_certificato,
              invitedAt: new Date(enrollment.data_invito),
              registeredAt: enrollment.data_registrazione ? new Date(enrollment.data_registrazione) : undefined
            };
          });
          
          setTrainings(mappedTrainings);
        }
      } catch (error) {
        console.error('Errore nel caricamento dei corsi:', error);
        setTrainings([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadTrainings();
  }, [user?.id]);

  const getCategoryLabel = (category: string) => {
    const labels = {
      safety: 'Sicurezza',
      technical: 'Tecnico',
      soft_skills: 'Soft Skills',
      certification: 'Certificazione',
      other: 'Altro'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'safety': return 'bg-red-100 text-red-800';
      case 'technical': return 'bg-blue-100 text-blue-800';
      case 'soft_skills': return 'bg-purple-100 text-purple-800';
      case 'certification': return 'bg-green-100 text-green-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'invited': return 'bg-yellow-100 text-yellow-800';
      case 'registered': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'attended': return 'bg-purple-100 text-purple-800';
      case 'no_show': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'invited': return 'Invitato';
      case 'registered': return 'Registrato';
      case 'confirmed': return 'Confermato';
      case 'attended': return 'Partecipato';
      case 'no_show': return 'Non Presentato';
      case 'cancelled': return 'Annullato';
      default: return status;
    }
  };

  const isUpcoming = (date: string) => {
    return new Date(date) > new Date();
  };

  const filteredTrainings = trainings.filter(training => {
    // Search filter
    if (searchTerm && !training.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !training.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !training.companyName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (filters.status === 'upcoming' && !isUpcoming(training.date)) return false;
    if (filters.status === 'past' && isUpcoming(training.date)) return false;

    // Category filter
    if (filters.category !== 'all' && training.category !== filters.category) return false;

    // Company filter
    if (filters.company !== 'all' && training.companyId !== filters.company) return false;

    return true;
  });

  const handleViewDetails = (training: Training) => {
    setSelectedTraining(training);
    setShowDetailModal(true);
  };

  const handleRegister = (trainingId: string) => {
    setTrainings(trainings.map(t => 
      t.id === trainingId 
        ? { ...t, status: 'registered', registeredAt: new Date() }
        : t
    ));
  };

  const handleConfirm = (trainingId: string) => {
    setTrainings(trainings.map(t => 
      t.id === trainingId 
        ? { ...t, status: 'confirmed' }
        : t
    ));
  };

  const handleDownloadCertificate = (certificateUrl?: string) => {
    if (!certificateUrl) return;
    
    // In a real app, this would download the certificate
    window.open(certificateUrl, '_blank');
  };

  const handleDownloadMaterial = (materialName: string) => {
    // In a real app, this would download the material
    alert(`Downloading ${materialName}...`);
  };

  // Get unique companies for filter
  const companies = Array.from(new Set(trainings.map(t => ({ id: t.companyId, name: t.companyName }))))
    .filter((company, index, self) => self.findIndex(c => c.id === company.id) === index);

  // Statistics
  const upcomingCount = trainings.filter(t => isUpcoming(t.date)).length;
  const attendedCount = trainings.filter(t => t.status === 'attended').length;
  const certificatesCount = trainings.filter(t => t.certificateIssued).length;
  const mandatoryCount = trainings.filter(t => t.isMandatory).length;

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
        <h1 className="text-2xl font-bold text-gray-900">I Miei Corsi</h1>
        <p className="text-gray-600">Visualizza e gestisci i tuoi corsi di formazione e certificazioni</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Corsi in Programma</p>
              <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Corsi Completati</p>
              <p className="text-2xl font-bold text-gray-900">{attendedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Certificati</p>
              <p className="text-2xl font-bold text-gray-900">{certificatesCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Corsi Obbligatori</p>
              <p className="text-2xl font-bold text-gray-900">{mandatoryCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Filtri</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 border border-gray-300 rounded-md px-3 py-2"
                placeholder="Cerca corsi..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="upcoming">In Programma</option>
              <option value="past">Passati</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutte</option>
              <option value="safety">Sicurezza</option>
              <option value="technical">Tecnico</option>
              <option value="soft_skills">Soft Skills</option>
              <option value="certification">Certificazione</option>
              <option value="other">Altro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Azienda</label>
            <select
              value={filters.company}
              onChange={(e) => setFilters({ ...filters, company: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutte</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Trainings List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Corsi ({filteredTrainings.length})
          </h3>
        </div>
        
        {filteredTrainings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessun corso di formazione</p>
            <p className="text-sm mt-1">Non sei ancora iscritto a nessun corso di formazione</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTrainings.map((training) => (
              <div key={training.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">{training.title}</h4>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(training.category)}`}>
                        {getCategoryLabel(training.category)}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(training.status)}`}>
                        {getStatusLabel(training.status)}
                      </span>
                      {training.isMandatory && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Obbligatorio
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{training.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(training.date).toLocaleDateString('it-IT')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{training.startTime} - {training.endTime}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{training.location}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Building2 className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-700">
                          {training.companyName}
                        </span>
                      </div>
                      {training.certificateIssued && (
                        <div className="flex items-center space-x-1">
                          <FileText className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">
                            Certificato Disponibile
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleViewDetails(training)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center justify-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Dettagli</span>
                    </button>
                    
                    {training.status === 'invited' && (
                      <button
                        onClick={() => handleRegister(training.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center justify-center space-x-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Registrati</span>
                      </button>
                    )}
                    
                    {training.status === 'registered' && (
                      <button
                        onClick={() => handleConfirm(training.id)}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center justify-center space-x-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Conferma</span>
                      </button>
                    )}
                    
                    {training.certificateIssued && training.certificateUrl && (
                      <button
                        onClick={() => handleDownloadCertificate(training.certificateUrl)}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 flex items-center justify-center space-x-1"
                      >
                        <Download className="h-4 w-4" />
                        <span>Certificato</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTraining && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Dettagli Corso
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Course Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Informazioni Corso</h4>
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Titolo</label>
                        <p className="text-sm text-gray-900">{selectedTraining.title}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Descrizione</label>
                        <p className="text-sm text-gray-900">{selectedTraining.description}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Istruttore</label>
                        <p className="text-sm text-gray-900">{selectedTraining.instructor}</p>
                      </div>
                      <div className="flex space-x-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Categoria</label>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(selectedTraining.category)}`}>
                            {getCategoryLabel(selectedTraining.category)}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Status</label>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedTraining.status)}`}>
                            {getStatusLabel(selectedTraining.status)}
                          </span>
                        </div>
                        {selectedTraining.isMandatory && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500">Tipo</label>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Obbligatorio
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Logistica</h4>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Data</label>
                          <p className="text-sm text-gray-900">{new Date(selectedTraining.date).toLocaleDateString('it-IT')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Orario</label>
                          <p className="text-sm text-gray-900">{selectedTraining.startTime} - {selectedTraining.endTime}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Luogo</label>
                          <p className="text-sm text-gray-900">{selectedTraining.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Azienda</label>
                          <p className="text-sm text-gray-900">{selectedTraining.companyName}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Date Importanti</h4>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Invito ricevuto:</span>
                        <span className="text-gray-900">{selectedTraining.invitedAt.toLocaleDateString('it-IT')}</span>
                      </div>
                      {selectedTraining.registeredAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Registrazione:</span>
                          <span className="text-gray-900">{selectedTraining.registeredAt.toLocaleDateString('it-IT')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Materials and Certificate */}
                <div className="space-y-6">
                  {selectedTraining.materials && selectedTraining.materials.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Materiali del Corso</h4>
                      <div className="space-y-2">
                        {selectedTraining.materials.map((material, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-5 w-5 text-blue-500" />
                              <span className="text-sm text-gray-900">{material}</span>
                            </div>
                            <button
                              onClick={() => handleDownloadMaterial(material)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTraining.certificateIssued && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Certificato</h4>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="text-sm font-medium text-green-900">Certificato Rilasciato</p>
                              <p className="text-xs text-green-700">
                                Certificazione valida per il corso {selectedTraining.title}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadCertificate(selectedTraining.certificateUrl)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center space-x-1"
                          >
                            <Download className="h-4 w-4" />
                            <span>Scarica</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status and Actions */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Status e Azioni</h4>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Status Attuale:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedTraining.status)}`}>
                          {getStatusLabel(selectedTraining.status)}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {selectedTraining.status === 'invited' && (
                          <button
                            onClick={() => {
                              handleRegister(selectedTraining.id);
                              setShowDetailModal(false);
                            }}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Registrati al Corso</span>
                          </button>
                        )}
                        
                        {selectedTraining.status === 'registered' && (
                          <button
                            onClick={() => {
                              handleConfirm(selectedTraining.id);
                              setShowDetailModal(false);
                            }}
                            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Conferma Partecipazione</span>
                          </button>
                        )}
                        
                        {selectedTraining.certificateIssued && selectedTraining.certificateUrl && (
                          <button
                            onClick={() => handleDownloadCertificate(selectedTraining.certificateUrl)}
                            className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 flex items-center justify-center space-x-2"
                          >
                            <Download className="h-4 w-4" />
                            <span>Scarica Certificato</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

export default TrainingHistory;