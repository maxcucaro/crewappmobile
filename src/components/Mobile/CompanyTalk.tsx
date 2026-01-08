import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, FileText, Image, Mic, Download, Trash2, Volume2, X, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

interface CompanyTalk {
  id: string;
  sender_company_id: string;
  sender_name: string;
  message_type: 'text' | 'audio' | 'image' | 'file';
  message_text: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_urgent: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
  company_name?: string;
}

interface CompanyTalkProps {
  openTalkId?: string | null;
  onClose?: () => void;
}

export default function CompanyTalk({ openTalkId, onClose }: CompanyTalkProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<CompanyTalk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<CompanyTalk | null>(null);
  const [filterUnread, setFilterUnread] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (user) {
      loadMessages();
      subscribeToNewMessages();
    }
  }, [user, filterUnread]);

  useEffect(() => {
    if (openTalkId && messages.length > 0) {
      const messageToOpen = messages.find(m => m.id === openTalkId);
      if (messageToOpen) {
        openMessage(messageToOpen);
      }
    }
  }, [openTalkId, messages]);

  const getSignedUrl = async (fileUrl: string | null): Promise<string | null> => {
    if (!fileUrl) return null;

    try {
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/company-talks\/(.+)$/);

      if (!pathMatch || !pathMatch[1]) {
        console.error('Impossibile estrarre il percorso dal file URL:', fileUrl);
        return fileUrl;
      }

      const filePath = pathMatch[1];
      const { data, error } = await supabase.storage
        .from('company-talks')
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error('Errore creazione signed URL:', error);
        return fileUrl;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Errore nel parsing dell\'URL:', error);
      return fileUrl;
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('company_talks')
        .select(`
          *,
          regaziendasoftware!sender_company_id (
            ragione_sociale
          )
        `)
        .eq('recipient_id', user?.id)
        .order('created_at', { ascending: false });

      if (filterUnread) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      const messagesWithCompany = await Promise.all(
        (data || []).map(async (msg) => {
          const signedUrl = await getSignedUrl(msg.file_url);
          return {
            ...msg,
            company_name: msg.regaziendasoftware?.ragione_sociale || 'Azienda',
            file_url: signedUrl
          };
        })
      );

      setMessages(messagesWithCompany);
    } catch (error: any) {
      console.error('Errore caricamento messaggi:', error);
      showToast('Errore nel caricamento dei messaggi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNewMessages = () => {
    const channel = supabase
      .channel('company_talks_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_talks',
          filter: `recipient_id=eq.${user?.id}`
        },
        (payload) => {
          loadMessages();
          showToast('Nuovo messaggio ricevuto!', 'success');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase.rpc('mark_talk_as_read', {
        talk_id: messageId
      });

      if (error) throw error;

      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, is_read: true, read_at: new Date().toISOString() }
            : msg
        )
      );
    } catch (error: any) {
      console.error('Errore aggiornamento messaggio:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Eliminare questo messaggio?')) return;

    try {
      const { error } = await supabase
        .from('company_talks')
        .delete()
        .eq('id', messageId)
        .eq('recipient_id', user?.id);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setSelectedMessage(null);
      showToast('Messaggio eliminato', 'success');
    } catch (error: any) {
      console.error('Errore eliminazione messaggio:', error);
      showToast('Errore durante l\'eliminazione', 'error');
    }
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('company-talks')
        .download(fileUrl.split('/').pop() || '');

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('File scaricato', 'success');
    } catch (error: any) {
      console.error('Errore download file:', error);
      showToast('Errore durante il download', 'error');
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <MessageSquare className="w-5 h-5" />;
      case 'audio':
        return <Mic className="w-5 h-5" />;
      case 'image':
        return <Image className="w-5 h-5" />;
      case 'file':
        return <FileText className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;

    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const openMessage = (message: CompanyTalk) => {
    setSelectedMessage(message);
    if (!message.is_read) {
      markAsRead(message.id);
    }
  };

  const renderMessagePreview = (message: CompanyTalk) => {
    switch (message.message_type) {
      case 'text':
        return (
          <p className="text-sm text-gray-300 line-clamp-2">
            {message.message_text}
          </p>
        );
      case 'audio':
        return (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Messaggio vocale
          </p>
        );
      case 'image':
        return (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Image className="w-4 h-4" />
            Immagine
          </p>
        );
      case 'file':
        return (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {message.file_name}
          </p>
        );
      default:
        return null;
    }
  };

  const renderMessageContent = (message: CompanyTalk) => {
    switch (message.message_type) {
      case 'text':
        return (
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-200 whitespace-pre-wrap">{message.message_text}</p>
          </div>
        );

      case 'audio':
        return (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Volume2 className="w-6 h-6 text-blue-400" />
              <div>
                <p className="font-medium text-white">Messaggio vocale</p>
                {message.file_size && (
                  <p className="text-sm text-gray-400">{formatFileSize(message.file_size)}</p>
                )}
              </div>
            </div>
            {message.file_url && (
              <audio
                ref={audioRef}
                controls
                preload="metadata"
                className="w-full"
                src={message.file_url}
              />
            )}
          </div>
        );

      case 'image':
        return (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            {message.file_url && (
              <img
                src={message.file_url}
                alt={message.file_name || 'Immagine'}
                className="w-full rounded-lg"
              />
            )}
            {message.file_name && (
              <p className="text-sm text-gray-400 mt-2">{message.file_name}</p>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="font-medium text-white">{message.file_name}</p>
                  {message.file_size && (
                    <p className="text-sm text-gray-400">{formatFileSize(message.file_size)}</p>
                  )}
                </div>
              </div>
              {message.file_url && (
                <button
                  onClick={() => downloadFile(message.file_url!, message.file_name!)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5 text-blue-400" />
                </button>
              )}
            </div>
          </div>
        );

      default:
        return null;
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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Messaggi Azienda</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterUnread
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterUnread ? 'Tutti' : 'Non letti'}
            </button>
          </div>
        </div>

        {messages.filter(m => !m.is_read).length > 0 && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <p className="text-sm text-blue-200">
              {messages.filter(m => !m.is_read).length} messaggi non letti
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nessun messaggio</p>
            <p className="text-sm">I messaggi dall'azienda appariranno qui</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => openMessage(message)}
                className={`p-4 cursor-pointer transition-colors ${
                  !message.is_read ? 'bg-blue-900/20 hover:bg-blue-900/30' : 'hover:bg-gray-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      message.is_urgent
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {getMessageIcon(message.message_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-white">
                        {message.company_name || message.sender_name}
                      </p>
                      {message.is_urgent && (
                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Urgente
                        </span>
                      )}
                    </div>

                    {renderMessagePreview(message)}

                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-gray-400">
                        {formatDate(message.created_at)}
                      </p>
                      {message.is_read && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Letto
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedMessage.company_name || selectedMessage.sender_name}
                </h3>
                <p className="text-sm text-gray-400">
                  {formatDate(selectedMessage.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-300" />
              </button>
            </div>

            <div className="p-4">
              {selectedMessage.is_urgent && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-sm text-red-300 font-medium">Messaggio urgente</p>
                </div>
              )}

              {renderMessageContent(selectedMessage)}

              {selectedMessage.expires_at && (
                <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
                  <p className="text-sm text-amber-300">
                    Questo messaggio verrà eliminato automaticamente il{' '}
                    {new Date(selectedMessage.expires_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 flex gap-2">
              <button
                onClick={() => deleteMessage(selectedMessage.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Elimina
              </button>
              <button
                onClick={() => setSelectedMessage(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
