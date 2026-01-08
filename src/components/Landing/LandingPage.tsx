import React, { useState, useEffect } from 'react';
import { Users, Calendar, Clock, Shield, FileText, QrCode, ArrowRight, CheckCircle, Download, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/db';

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.8.4');
  const [releaseDate, setReleaseDate] = useState<string>('Dicembre 2025');

  const formatReleaseDate = (dateString: string): string => {
    const date = new Date(dateString);
    const months = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${month} ${year}`;
  };

  useEffect(() => {
    const loadVersionInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('software_versions')
          .select('current_version, release_date')
          .eq('software_code', 'crew_mobile')
          .eq('is_active', true)
          .order('release_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setAppVersion(data.current_version);
          setReleaseDate(formatReleaseDate(data.release_date));
        }
      } catch (error) {
        console.error('Errore caricamento versione:', error);
      }
    };

    loadVersionInfo();
    setIsVisible(true);
    
    // Auto-rotate feature cards
    const interval = setInterval(() => {
      setCurrentCard((prev) => (prev + 1) % 3);
    }, 4000);

    // Controlla se il prompt di installazione è disponibile
    const checkInstallPrompt = () => {
      const prompt = (window as any).deferredPrompt;
      if (prompt) {
        console.log('📱 Install prompt disponibile');
        setShowInstallButton(true);
      }
    };
    
    // Controlla subito e poi ogni secondo per 10 secondi
    checkInstallPrompt();
    const checkInterval = setInterval(checkInstallPrompt, 1000);
    
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 10000);

    // Ascolta per nuovi prompt
    const handlePromptAvailable = () => {
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handlePromptAvailable);

    return () => {
      clearInterval(interval);
      clearInterval(checkInterval);
      window.removeEventListener('beforeinstallprompt', handlePromptAvailable);
    };
  }, []);

  const handleInstallApp = async () => {
    const prompt = (window as any).deferredPrompt;
    if (!prompt) {
      console.log('❌ Prompt installazione non disponibile');
      // Mostra istruzioni manuali
      showManualInstallInstructions();
      return;
    }

    console.log('📱 Avvio installazione PWA');
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installata con successo');
      setShowInstallButton(false);
    } else {
      console.log('Installazione rifiutata dall\'utente');
    }
    
    (window as any).deferredPrompt = null;
  };

  // Mostra istruzioni installazione manuale
  const showManualInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
      instructions = `
        <strong>📱 Su iPhone/iPad:</strong><br>
        1. Tocca il pulsante "Condividi" (⬆️)<br>
        2. Scorri e tocca "Aggiungi alla schermata Home"<br>
        3. Conferma il nome dell'app<br>
        4. L'icona apparirà sulla home screen
      `;
    } else if (isAndroid) {
      instructions = `
        <strong>📱 Su Android:</strong><br>
        1. Tocca i 3 puntini (⋮) in alto a destra<br>
        2. Seleziona "Aggiungi alla schermata Home"<br>
        3. Conferma il nome dell'app<br>
        4. L'icona apparirà sulla home screen
      `;
    } else {
      instructions = `
        <strong>💻 Su Desktop:</strong><br>
        1. Cerca l'icona "Installa" nella barra degli indirizzi<br>
        2. Clicca su "Installa"<br>
        3. L'app si aprirà in una finestra dedicata
      `;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 24px; max-width: 400px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
        <h3 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; color: #1f2937;">Come Installare CrewApp</h3>
        <div style="color: #6b7280; margin-bottom: 20px; font-size: 14px; text-align: left; line-height: 1.6;">
          ${instructions}
        </div>
        <button id="close-manual" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%;">
          Ho Capito
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('#close-manual');
    closeBtn?.addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  };

  const featureCards = [
    {
      icon: Clock,
      title: 'Timesheet Digitale',
      description: 'Registra le tue ore di lavoro con precisione GPS e approvazione automatica',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Calendar,
      title: 'Calendario Aziendale',
      description: 'Visualizza eventi, turni magazzino e gestisci le tue disponibilità',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: FileText,
      title: 'Documenti Digitali',
      description: 'Accedi a buste paga, contratti e certificazioni in formato digitale',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden flex flex-col">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 md:top-10 md:left-10 w-16 h-16 sm:w-24 sm:h-24 md:w-48 md:h-48 bg-white rounded-full opacity-5 animate-pulse"></div>
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 md:bottom-10 md:right-10 w-12 h-12 sm:w-16 sm:h-16 md:w-32 md:h-32 bg-cyan-300 rounded-full opacity-10 animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute top-1/3 left-1/4 w-8 h-8 sm:w-12 sm:h-12 md:w-24 md:h-24 bg-blue-300 rounded-full opacity-15 animate-ping" style={{ animationDuration: '4s' }}></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-3 sm:p-4 md:p-6 lg:p-8 flex-shrink-0">
          <div className={`text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-1 sm:mb-2">
              ControlStage
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm md:text-base lg:text-lg">
              Professional Event Management Solutions
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <div className="max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto text-center w-full">
            
            {/* Main Card */}
            <div className={`transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95'}`}>
              <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 lg:p-10 mb-4 sm:mb-6 md:mb-8">
                {/* Icon */}
                <div className="flex justify-center mb-3 sm:mb-4 md:mb-6 lg:mb-8">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-white" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-2 sm:mb-3 md:mb-4">
                  <span className="text-gray-800">CREW MOBILE </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 italic font-extrabold tracking-wider transform -skew-x-12 inline-block text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl">APP</span>
                </h2>

                {/* Description */}
                <p className="text-gray-600 text-xs sm:text-sm md:text-base lg:text-lg leading-relaxed mb-3 sm:mb-4 md:mb-6 lg:mb-8 max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-2 sm:px-4">
                  Piattaforma digitale per il personale operativo.<br />
                  Gestisci autonomamente orari, eventi, ferie, note spese e check-in/out.
                </p>

                {/* Version Badge */}
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-3 md:space-x-4 mb-3 sm:mb-4 md:mb-6 lg:mb-8">
                  <span className="bg-blue-600 text-white px-3 sm:px-4 md:px-5 py-1 sm:py-2 rounded-full font-semibold text-xs sm:text-sm md:text-base">
                    Versione {appVersion}
                  </span>
                  <span className="text-gray-500 text-xs sm:text-sm md:text-base">
                    {releaseDate}
                  </span>
                </div>

                {/* Enter Button */}
                <button
                  onClick={onEnter}
                  className="group bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-2 sm:py-3 md:py-4 px-4 sm:px-6 md:px-8 lg:px-10 rounded-lg sm:rounded-xl md:rounded-2xl text-sm sm:text-base md:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-2 mx-auto w-full sm:w-auto"
                >
                  <span>Accedi al Portale Staff</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Install App Button */}
                {showInstallButton && (
                  <button
                    onClick={handleInstallApp}
                    className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 sm:py-3 md:py-4 px-4 sm:px-6 md:px-8 lg:px-10 rounded-lg sm:rounded-xl md:rounded-2xl text-sm sm:text-base md:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-2 mx-auto mt-3 sm:mt-4 w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                    <span>📱 Installa App sul Telefono</span>
                  </button>
                )}
              </div>
            </div>

            {/* Feature Cards */}
            <div className={`transform transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                {featureCards.map((feature, index) => {
                  const Icon = feature.icon;
                  const isActive = index === currentCard;
                  
                  return (
                    <div
                      key={index}
                      className={`transform transition-all duration-700 w-full ${
                        isActive 
                          ? 'scale-102 sm:scale-105 md:scale-110 -translate-y-1 sm:-translate-y-2 md:-translate-y-3' 
                          : 'scale-100 translate-y-0 opacity-90'
                      }`}
                    >
                      <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 h-full">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 bg-gradient-to-r ${feature.color} rounded-md sm:rounded-lg md:rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 lg:mb-6 shadow-lg`}>
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-8 lg:w-8 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-1 sm:mb-2 md:mb-3">
                          {feature.title}
                        </h3>
                        <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feature Indicators */}
              <div className="flex justify-center space-x-2 mt-4 sm:mt-6 md:mt-8">
                {featureCards.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentCard(index)}
                    className={`w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full transition-all duration-300 ${
                      index === currentCard 
                        ? 'bg-white scale-110 sm:scale-125 md:scale-150 shadow-lg' 
                        : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-3 sm:p-4 md:p-6 lg:p-8 flex-shrink-0 mt-auto">
          <div className={`text-center transform transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-3 md:space-x-4 lg:space-x-6 text-blue-100 text-xs sm:text-sm mb-2 sm:mb-3 md:mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Sistema Operativo</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Sicuro e Protetto</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Sempre Aggiornato</span>
              </div>
            </div>
            <p className="text-blue-200 text-xs sm:text-sm px-2 sm:px-4 md:px-6">
              © 2025 ControlStage - Crew App Mobile V. {appVersion} - {releaseDate}. Tutti i diritti riservati.
            </p>
          </div>
        </footer>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        @media (max-width: 640px) {
          .animate-blob {
            animation-duration: 10s;
          }
        }

        @media (min-width: 1024px) {
          .animate-float {
            animation-duration: 8s;
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;