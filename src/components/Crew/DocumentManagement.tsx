import React, { useState } from 'react';
import { FileText, Download, Eye, Calendar, Building2, AlertTriangle, CheckCircle, Upload, X, Search, Filter, Mail, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';

interface Document {
  id: string;
  title: string;
  type: 'payslip' | 'contract' | 'amendment' | 'certificate' | 'policy' | 'other';
  description?: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;
  isRead: boolean;
  isImportant: boolean;
  expiryDate?: string;
  relatedPeriod?: string; // Per buste paga: "2024-03" = Marzo 2024
  contractType?: 'permanent' | 'temporary' | 'freelance';
  contractStartDate?: string;
  contractEndDate?: string;
  notes?: string;
}

interface DocumentFilter {
  type: 'all' | 'payslip' | 'contract' | 'amendment' | 'certificate' | 'policy' | 'other';
  year: number | 'all';
  isRead: 'all' | 'read' | 'unread';
  isImportant: 'all' | 'important' | 'normal';
}

const DocumentManagement: React.FC = () => {
  const { user } = useAuth();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Carica i documenti reali dal database
  React.useEffect(() => {
    const loadDocuments = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Carica i documenti dalla tabella documents filtrata per uploaded_for
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select(`
            *,
            uploader:users!uploaded_by(email, role)
          `)
          .eq('uploaded_for', user.id)
          .order('uploaded_at', { ascending: false });
        
        if (documentsError) {
          console.error('Errore nel caricamento documenti:', documentsError);
          setDocuments([]);
        } else {
          // Mappa i dati dal database al formato dell'interfaccia
          const mappedDocuments: Document[] = (documentsData || []).map(doc => ({
            id: doc.id,
            title: doc.title,
            type: doc.type,
            description: doc.description,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileUrl: doc.file_url,
            uploadedBy: doc.uploaded_by,
            uploadedByName: doc.uploader?.role === 'company' ? doc.uploader.email : doc.uploader?.email || 'Utente Sconosciuto',
            uploadedAt: new Date(doc.uploaded_at),
            isRead: doc.is_read,
            isImportant: doc.is_important,
            expiryDate: doc.expiry_date,
            relatedPeriod: doc.related_period,
            contractType: doc.contract_type,
            contractStartDate: doc.contract_start_date,
            contractEndDate: doc.contract_end_date,
            notes: doc.notes
          }));
          
          setDocuments(mappedDocuments);
        }
      } catch (error) {
        console.error('Errore nel caricamento dei documenti:', error);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadDocuments();
  }, [user?.id]);
  const [filters, setFilters] = useState<DocumentFilter>({
    type: 'all',
    year: 2024,
    isRead: 'all',
    isImportant: 'all'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showModal, setShowModal] = useState(false);

  const getDocumentTypeLabel = (type: string) => {
    const labels = {
      payslip: 'Busta Paga',
      contract: 'Contratto',
      amendment: 'Modifica Contrattuale',
      certificate: 'Certificato',
      policy: 'Regolamento',
      other: 'Altro'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDocumentTypeIcon = (type: string) => {
    const icons = {
      payslip: '💰',
      contract: '📋',
      amendment: '📝',
      certificate: '🏆',
      policy: '📖',
      other: '📄'
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'payslip': return 'bg-green-100 text-green-800';
      case 'contract': return 'bg-blue-100 text-blue-800';
      case 'amendment': return 'bg-purple-100 text-purple-800';
      case 'certificate': return 'bg-orange-100 text-orange-800';
      case 'policy': return 'bg-gray-100 text-gray-800';
      case 'other': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isDocumentExpiring = (expiryDate?: string): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isDocumentExpired = (expiryDate?: string): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const filteredDocuments = documents.filter(doc => {
    // Search filter
    if (searchTerm && !doc.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !doc.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Type filter
    if (filters.type !== 'all' && doc.type !== filters.type) return false;

    // Year filter
    if (filters.year !== 'all') {
      const docYear = doc.uploadedAt.getFullYear();
      if (docYear !== filters.year) return false;
    }

    // Read status filter
    if (filters.isRead === 'read' && !doc.isRead) return false;
    if (filters.isRead === 'unread' && doc.isRead) return false;

    // Important filter
    if (filters.isImportant === 'important' && !doc.isImportant) return false;
    if (filters.isImportant === 'normal' && doc.isImportant) return false;

    return true;
  });

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setShowModal(true);
    
    // Mark as read if not already read
    if (!document.isRead) {
      setDocuments(docs => docs.map(d => 
        d.id === document.id ? { ...d, isRead: true } : d
      ));
    }
  };

  const handleDownload = (document: Document) => {
    // In real app, would trigger actual download
    console.log('Downloading document:', document.fileName);
    window.open(document.fileUrl, '_blank');
  };

  const handleMarkAsRead = (documentId: string) => {
    const updateReadStatus = async () => {
      try {
        const { error } = await supabase
          .from('documents')
          .update({ is_read: true })
          .eq('id', documentId);
        
        if (error) throw error;
        
        setDocuments(docs => docs.map(d => 
          d.id === documentId ? { ...d, isRead: true } : d
        ));
      } catch (error) {
        console.error('Errore nell\'aggiornamento stato lettura:', error);
      }
    };
    
    updateReadStatus();
  };

  const handleMarkAsUnread = (documentId: string) => {
    const updateReadStatus = async () => {
      try {
        const { error } = await supabase
          .from('documents')
          .update({ is_read: false })
          .eq('id', documentId);
        
        if (error) throw error;
        
        setDocuments(docs => docs.map(d => 
          d.id === documentId ? { ...d, isRead: false } : d
        ));
      } catch (error) {
        console.error('Errore nell\'aggiornamento stato lettura:', error);
      }
    };
    
    updateReadStatus();
  };

  const unreadCount = documents.filter(d => !d.isRead).length;
  const importantCount = documents.filter(d => d.isImportant && !d.isRead).length;
  const expiringCount = documents.filter(d => isDocumentExpiring(d.expiryDate)).length;
  const expiredCount = documents.filter(d => isDocumentExpired(d.expiryDate)).length;

  // Group payslips by year for quick access
  const payslipsByYear = documents
    .filter(d => d.type === 'payslip')
    .reduce((acc, doc) => {
      const year = doc.uploadedAt.getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(doc);
      return acc;
    }, {} as Record<number, Document[]>);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">I Miei Documenti</h1>
          <p className="text-gray-600">Buste paga, contratti e documenti aziendali</p>
        </div>
        <div className="flex items-center space-x-3">
          {unreadCount > 0 && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
              <Bell className="h-4 w-4" />
              <span>{unreadCount} non letti</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(expiredCount > 0 || expiringCount > 0) && (
        <div className="space-y-3">
          {expiredCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-900">
                    {expiredCount} documento{expiredCount > 1 ? 'i' : ''} scaduto{expiredCount > 1 ? 'i' : ''}
                  </h4>
                  <p className="text-sm text-red-700">
                    Alcuni documenti sono scaduti. Contatta l'azienda per il rinnovo.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {expiringCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <h4 className="font-medium text-yellow-900">
                    {expiringCount} documento{expiringCount > 1 ? 'i' : ''} in scadenza
                  </h4>
                  <p className="text-sm text-yellow-700">
                    Alcuni documenti scadranno entro 30 giorni.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Totale Documenti</p>
              <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Non Letti</p>
              <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-orange-500 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Importanti</p>
              <p className="text-2xl font-bold text-gray-900">{importantCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Buste Paga 2024</p>
              <p className="text-2xl font-bold text-gray-900">{payslipsByYear[2024]?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access - Payslips */}
      {Object.keys(payslipsByYear).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Accesso Rapido Buste Paga</h3>
          
          {Object.entries(payslipsByYear)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, payslips]) => (
              <div key={year} className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Anno {year}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {payslips
                    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                    .map((payslip) => (
                      <div
                        key={payslip.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          !payslip.isRead ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => handleDocumentClick(payslip)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">💰</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {payslip.relatedPeriod && 
                                  new Date(payslip.relatedPeriod + '-01').toLocaleDateString('it-IT', { 
                                    month: 'long', 
                                    year: 'numeric' 
                                  })
                                }
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatFileSize(payslip.fileSize)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {!payslip.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(payslip);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Filtri e Ricerca</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 border border-gray-300 rounded-md px-3 py-2"
                placeholder="Cerca documenti..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="payslip">Buste Paga</option>
              <option value="contract">Contratti</option>
              <option value="amendment">Modifiche</option>
              <option value="certificate">Certificati</option>
              <option value="policy">Regolamenti</option>
              <option value="other">Altro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
              <option value={2022}>2022</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lettura</label>
            <select
              value={filters.isRead}
              onChange={(e) => setFilters({ ...filters, isRead: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="unread">Non Letti</option>
              <option value="read">Letti</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
            <select
              value={filters.isImportant}
              onChange={(e) => setFilters({ ...filters, isImportant: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="important">Importanti</option>
              <option value="normal">Normali</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Documenti ({filteredDocuments.length})
          </h3>
        </div>
        
        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessun documento disponibile</p>
            <p className="text-sm mt-1">Non hai ancora ricevuto documenti dall'azienda</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((document) => (
              <div
                key={document.id}
                className={`p-6 cursor-pointer transition-colors ${
                  !document.isRead ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleDocumentClick(document)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="text-2xl">{getDocumentTypeIcon(document.type)}</div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className={`font-medium ${!document.isRead ? 'text-blue-900' : 'text-gray-900'}`}>
                          {document.title}
                        </h4>
                        
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocumentTypeColor(document.type)}`}>
                          {getDocumentTypeLabel(document.type)}
                        </span>
                        
                        {document.isImportant && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Importante
                          </span>
                        )}
                        
                        {!document.isRead && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Nuovo
                          </span>
                        )}
                      </div>
                      
                      {document.description && (
                        <p className="text-sm text-gray-600 mb-2">{document.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-4 w-4" />
                          <span>{document.uploadedByName}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{document.uploadedAt.toLocaleDateString('it-IT')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FileText className="h-4 w-4" />
                          <span>{formatFileSize(document.fileSize)}</span>
                        </div>
                      </div>

                      {/* Contract specific info */}
                      {document.type === 'contract' && document.contractType && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Tipo contratto:</span> {
                            document.contractType === 'permanent' ? 'Tempo Indeterminato' :
                            document.contractType === 'temporary' ? 'Tempo Determinato' : 'Freelance'
                          }
                          {document.contractStartDate && (
                            <span> • Inizio: {new Date(document.contractStartDate).toLocaleDateString('it-IT')}</span>
                          )}
                          {document.contractEndDate && (
                            <span> • Fine: {new Date(document.contractEndDate).toLocaleDateString('it-IT')}</span>
                          )}
                        </div>
                      )}

                      {/* Expiry warnings */}
                      {document.expiryDate && (
                        <div className="mt-2">
                          {isDocumentExpired(document.expiryDate) ? (
                            <div className="flex items-center space-x-1 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Scaduto il {new Date(document.expiryDate).toLocaleDateString('it-IT')}
                              </span>
                            </div>
                          ) : isDocumentExpiring(document.expiryDate) ? (
                            <div className="flex items-center space-x-1 text-yellow-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Scade il {new Date(document.expiryDate).toLocaleDateString('it-IT')}
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Valido fino al {new Date(document.expiryDate).toLocaleDateString('it-IT')}
                            </div>
                          )}
                        </div>
                      )}

                      {document.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          <strong>Note:</strong> {document.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {!document.isRead && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(document);
                      }}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Scarica documento"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDocumentClick(document);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Visualizza dettagli"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Detail Modal */}
      {showModal && selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          onClose={() => setShowModal(false)}
          onDownload={handleDownload}
          onMarkAsRead={handleMarkAsRead}
          onMarkAsUnread={handleMarkAsUnread}
        />
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

// Document Detail Modal Component
interface DocumentDetailModalProps {
  document: Document;
  onClose: () => void;
  onDownload: (document: Document) => void;
  onMarkAsRead: (documentId: string) => void;
  onMarkAsUnread: (documentId: string) => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document,
  onClose,
  onDownload,
  onMarkAsRead,
  onMarkAsUnread
}) => {
  const getDocumentTypeLabel = (type: string) => {
    const labels = {
      payslip: 'Busta Paga',
      contract: 'Contratto',
      amendment: 'Modifica Contrattuale',
      certificate: 'Certificato',
      policy: 'Regolamento',
      other: 'Altro'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isDocumentExpiring = (expiryDate?: string): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isDocumentExpired = (expiryDate?: string): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{document.title}</h3>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  document.type === 'payslip' ? 'bg-green-100 text-green-800' :
                  document.type === 'contract' ? 'bg-blue-100 text-blue-800' :
                  document.type === 'amendment' ? 'bg-purple-100 text-purple-800' :
                  document.type === 'certificate' ? 'bg-orange-100 text-orange-800' :
                  document.type === 'policy' ? 'bg-gray-100 text-gray-800' :
                  'bg-indigo-100 text-indigo-800'
                }`}>
                  {getDocumentTypeLabel(document.type)}
                </span>
                
                {document.isImportant && (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                    Importante
                  </span>
                )}
                
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  document.isRead ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {document.isRead ? 'Letto' : 'Non Letto'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Document Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Informazioni Documento</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nome File</label>
                    <p className="text-sm text-gray-900">{document.fileName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dimensione</label>
                    <p className="text-sm text-gray-900">{formatFileSize(document.fileSize)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Caricato da</label>
                    <p className="text-sm text-gray-900">{document.uploadedByName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Caricamento</label>
                    <p className="text-sm text-gray-900">
                      {document.uploadedAt.toLocaleDateString('it-IT')} alle {document.uploadedAt.toLocaleTimeString('it-IT')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Dettagli Specifici</h4>
                <div className="space-y-3">
                  {document.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Descrizione</label>
                      <p className="text-sm text-gray-900">{document.description}</p>
                    </div>
                  )}

                  {document.relatedPeriod && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Periodo di Riferimento</label>
                      <p className="text-sm text-gray-900">
                        {new Date(document.relatedPeriod + '-01').toLocaleDateString('it-IT', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}

                  {document.contractType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tipo Contratto</label>
                      <p className="text-sm text-gray-900">
                        {document.contractType === 'permanent' ? 'Tempo Indeterminato' :
                         document.contractType === 'temporary' ? 'Tempo Determinato' : 'Freelance'}
                      </p>
                    </div>
                  )}

                  {document.contractStartDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Inizio Contratto</label>
                      <p className="text-sm text-gray-900">
                        {new Date(document.contractStartDate).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  )}

                  {document.contractEndDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Fine Contratto</label>
                      <p className="text-sm text-gray-900">
                        {new Date(document.contractEndDate).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  )}

                  {document.expiryDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Scadenza</label>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-900">
                          {new Date(document.expiryDate).toLocaleDateString('it-IT')}
                        </p>
                        {isDocumentExpired(document.expiryDate) ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Scaduto
                          </span>
                        ) : isDocumentExpiring(document.expiryDate) ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            In Scadenza
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Valido
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {document.notes && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Note</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">{document.notes}</p>
                </div>
              </div>
            )}

            {/* Document Preview Placeholder */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Anteprima Documento</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-2">Anteprima non disponibile</p>
                <p className="text-sm text-gray-500">Scarica il documento per visualizzarlo</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
            <div className="flex space-x-2">
              {document.isRead ? (
                <button
                  onClick={() => onMarkAsUnread(document.id)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>Segna come Non Letto</span>
                </button>
              ) : (
                <button
                  onClick={() => onMarkAsRead(document.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Segna come Letto</span>
                </button>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Chiudi
              </button>
              <button
                onClick={() => onDownload(document)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Scarica</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManagement;