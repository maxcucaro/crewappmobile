import React, { useState } from 'react';
import { Building2, User, Mail, Phone, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

type RegistrationType = 'azienda' | 'tecnico';

const RegistrationForm: React.FC = () => {
  const [registrationType, setRegistrationType] = useState<RegistrationType>('azienda');
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data for company
  const [companyData, setCompanyData] = useState({
    nome_azienda: '',
    email: '',
    telefono: '',
    partita_iva: '',
    indirizzo: '',
    persona_contatto: '',
    email_contatto: '',
    telefono_contatto: '',
    sito_web: '',
    piano: 'base',
    messaggio: ''
  });

  // Form data for crew
  const [crewData, setCrewData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    indirizzo: '',
    tipo_profilo: 'freelance',
    anni_esperienza: 0,
    tariffa_oraria: '',
    competenze: [] as string[],
    biografia: '',
    messaggio: ''
  });

  // Available skills for crew
  const availableSkills = [
    'Audio', 'Luci', 'Video', 'Regia', 'Streaming', 'Montaggio',
    'Allestimenti', 'Logistica', 'Coordinamento', 'Sicurezza',
    'Elettricista', 'Carpentiere', 'Grafica', 'Fotografia'
  ];

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({ ...prev, [name]: value }));
  };

  const handleCrewChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCrewData(prev => ({ ...prev, [name]: value }));
  };

  const handleSkillToggle = (skill: string) => {
    setCrewData(prev => {
      const skills = [...prev.competenze];
      if (skills.includes(skill)) {
        return { ...prev, competenze: skills.filter(s => s !== skill) };
      } else {
        return { ...prev, competenze: [...skills, skill] };
      }
    });
  };

  const validateStep1 = () => {
    if (registrationType === 'azienda') {
      if (!companyData.nome_azienda || !companyData.email || !companyData.partita_iva) {
        setError('Compila tutti i campi obbligatori (Nome azienda, Email, Partita IVA)');
        return false;
      }
    } else {
      if (!crewData.nome || !crewData.cognome || !crewData.email) {
        setError('Compila tutti i campi obbligatori (Nome, Cognome, Email)');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Inserisci la richiesta di registrazione nella tabella registration_requests
      if (registrationType === 'azienda') {
        const { error } = await supabase
          .from('registration_requests')
          .insert({
            id: uuidv4(),
            company_name: companyData.nome_azienda,
            email: companyData.email,
            phone: companyData.telefono,
            plan_type: companyData.piano,
            message: companyData.messaggio,
            status: 'pending'
          });

        if (error) throw error;
      } else {
        // Per i tecnici, inseriamo una richiesta simile
        const { error } = await supabase
          .from('registration_requests')
          .insert({
            id: uuidv4(),
            company_name: `${crewData.nome} ${crewData.cognome}`,
            email: crewData.email,
            phone: crewData.telefono,
            plan_type: 'base',
            message: crewData.messaggio,
            status: 'pending'
          });

        if (error) throw error;
      }

      setRegistrationSuccess(true);
    } catch (error) {
      console.error('Error during registration:', error);
      setError('Si è verificato un errore durante la registrazione. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md mx-auto">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registrazione Inviata!</h2>
          <p className="text-gray-600 mb-6">
            La tua richiesta di registrazione è stata inviata con successo. Un amministratore la esaminerà a breve.
            Riceverai un'email quando la tua richiesta sarà stata approvata.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Registrazione</h1>
        <p className="text-gray-600">Crea un nuovo account per accedere alla piattaforma</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setRegistrationType('azienda')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center space-x-2 ${
              registrationType === 'azienda'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="h-5 w-5" />
            <span>Azienda</span>
          </button>
          <button
            type="button"
            onClick={() => setRegistrationType('tecnico')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center space-x-2 ${
              registrationType === 'tecnico'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <User className="h-5 w-5" />
            <span>Tecnico</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="space-y-6">
            {registrationType === 'azienda' ? (
              <>
                <div>
                  <label htmlFor="nome_azienda" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Azienda *
                  </label>
                  <input
                    id="nome_azienda"
                    name="nome_azienda"
                    type="text"
                    value={companyData.nome_azienda}
                    onChange={handleCompanyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={companyData.email}
                      onChange={handleCompanyChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono
                    </label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      value={companyData.telefono}
                      onChange={handleCompanyChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="partita_iva" className="block text-sm font-medium text-gray-700 mb-1">
                    Partita IVA *
                  </label>
                  <input
                    id="partita_iva"
                    name="partita_iva"
                    type="text"
                    value={companyData.partita_iva}
                    onChange={handleCompanyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="indirizzo" className="block text-sm font-medium text-gray-700 mb-1">
                    Indirizzo
                  </label>
                  <input
                    id="indirizzo"
                    name="indirizzo"
                    type="text"
                    value={companyData.indirizzo}
                    onChange={handleCompanyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
                    </label>
                    <input
                      id="nome"
                      name="nome"
                      type="text"
                      value={crewData.nome}
                      onChange={handleCrewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="cognome" className="block text-sm font-medium text-gray-700 mb-1">
                      Cognome *
                    </label>
                    <input
                      id="cognome"
                      name="cognome"
                      type="text"
                      value={crewData.cognome}
                      onChange={handleCrewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={crewData.email}
                      onChange={handleCrewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono
                    </label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      value={crewData.telefono}
                      onChange={handleCrewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="indirizzo" className="block text-sm font-medium text-gray-700 mb-1">
                    Indirizzo
                  </label>
                  <input
                    id="indirizzo"
                    name="indirizzo"
                    type="text"
                    value={crewData.indirizzo}
                    onChange={handleCrewChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="tipo_profilo" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo Profilo *
                  </label>
                  <select
                    id="tipo_profilo"
                    name="tipo_profilo"
                    value={crewData.tipo_profilo}
                    onChange={handleCrewChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="freelance">Freelance</option>
                    <option value="dipendente">Dipendente</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleNextStep}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Avanti
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {registrationType === 'azienda' ? (
              <>
                <div>
                  <label htmlFor="persona_contatto" className="block text-sm font-medium text-gray-700 mb-1">
                    Persona di Contatto
                  </label>
                  <input
                    id="persona_contatto"
                    name="persona_contatto"
                    type="text"
                    value={companyData.persona_contatto}
                    onChange={handleCompanyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email_contatto" className="block text-sm font-medium text-gray-700 mb-1">
                      Email di Contatto
                    </label>
                    <input
                      id="email_contatto"
                      name="email_contatto"
                      type="email"
                      value={companyData.email_contatto}
                      onChange={handleCompanyChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="telefono_contatto" className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono di Contatto
                    </label>
                    <input
                      id="telefono_contatto"
                      name="telefono_contatto"
                      type="tel"
                      value={companyData.telefono_contatto}
                      onChange={handleCompanyChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="sito_web" className="block text-sm font-medium text-gray-700 mb-1">
                    Sito Web
                  </label>
                  <input
                    id="sito_web"
                    name="sito_web"
                    type="url"
                    value={companyData.sito_web}
                    onChange={handleCompanyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://www.example.com"
                  />
                </div>

                <div>
                  <label htmlFor="piano" className="block text-sm font-medium text-gray-700 mb-1">
                    Piano
                  </label>
                  <select
                    id="piano"
                    name="piano"
                    value={companyData.piano}
                    onChange={handleCompanyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="base">Base</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="messaggio" className="block text-sm font-medium text-gray-700 mb-1">
                    Messaggio (opzionale)
                  </label>
                  <textarea
                    id="messaggio"
                    name="messaggio"
                    value={companyData.messaggio}
                    onChange={handleCompanyChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Informazioni aggiuntive o richieste particolari..."
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="anni_esperienza" className="block text-sm font-medium text-gray-700 mb-1">
                      Anni di Esperienza
                    </label>
                    <input
                      id="anni_esperienza"
                      name="anni_esperienza"
                      type="number"
                      min="0"
                      value={crewData.anni_esperienza}
                      onChange={handleCrewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="tariffa_oraria" className="block text-sm font-medium text-gray-700 mb-1">
                      Tariffa Oraria (€)
                    </label>
                    <input
                      id="tariffa_oraria"
                      name="tariffa_oraria"
                      type="number"
                      min="0"
                      step="0.01"
                      value={crewData.tariffa_oraria}
                      onChange={handleCrewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Competenze
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableSkills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          crewData.competenze.includes(skill)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="biografia" className="block text-sm font-medium text-gray-700 mb-1">
                    Biografia
                  </label>
                  <textarea
                    id="biografia"
                    name="biografia"
                    value={crewData.biografia}
                    onChange={handleCrewChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Breve descrizione della tua esperienza e specializzazioni..."
                  />
                </div>

                <div>
                  <label htmlFor="messaggio" className="block text-sm font-medium text-gray-700 mb-1">
                    Messaggio (opzionale)
                  </label>
                  <textarea
                    id="messaggio"
                    name="messaggio"
                    value={crewData.messaggio}
                    onChange={handleCrewChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Informazioni aggiuntive o richieste particolari..."
                  />
                </div>
              </>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={handlePrevStep}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
              >
                Indietro
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="mt-8 pt-6 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-600">
          Hai già un account?{' '}
          <a href="/" className="text-blue-600 hover:text-blue-800">
            Accedi
          </a>
        </p>
        
        {/* Copyright */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            © 2025 ControlStage - Crew App Mobile V. 1.0.1
          </p>
          <p className="text-xs text-gray-400">
            Tutti i diritti riservati - Software realizzato da ControlStage
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;