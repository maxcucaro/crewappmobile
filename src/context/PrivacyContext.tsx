import React, { createContext, useContext, useState, useEffect } from 'react';
import { CrewPrivacySettings, CompanyCrewVisibility, CalendarSync, PrivacyField } from '../types/privacy';
import { useAuth } from './AuthContext';

interface PrivacyContextType {
  // Privacy Settings
  crewPrivacySettings: CrewPrivacySettings[];
  addCrewPrivacy: (settings: CrewPrivacySettings) => void;
  updateCrewPrivacy: (crewId: string, settings: Partial<CrewPrivacySettings>) => void;
  hideFromCompany: (crewId: string, companyId: string, hiddenFields?: PrivacyField[]) => void;
  unhideFromCompany: (crewId: string, companyId: string) => void;
  
  // Visibility
  getVisibleCrewForCompany: (companyId: string) => string[];
  isCrewVisibleToCompany: (crewId: string, companyId: string) => boolean;
  getHiddenFieldsForCompany: (crewId: string, companyId: string) => PrivacyField[];
  
  // Calendar Sync
  calendarSyncs: CalendarSync[];
  syncCrewCalendar: (crewId: string, eventDate: string, eventId: string, companyId: string) => void;
  getCrewBusyDates: (crewId: string) => string[];
  isCrewAvailableOnDate: (crewId: string, date: string) => boolean;
  
  // Notifications
  sendPrivacyNotification: (crewId: string, type: 'calendar_sync' | 'privacy_update', data: any) => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Mock data - in real app would come from API
  const [crewPrivacySettings, setCrewPrivacySettings] = useState<CrewPrivacySettings[]>([
    {
      crewId: 'crew-1',
      isPublicProfile: true,
      hiddenFromCompanies: ['company-2'], // Mario Rossi nascosto da TechEvents
      hiddenFields: {
        'company-2': ['hourlyRate', 'phone'], // Nasconde solo tariffa e telefono
        'company-3': ['hourlyRate', 'experience', 'phone', 'address'] // Nasconde più info
      }
    },
    {
      crewId: 'crew-2',
      isPublicProfile: true,
      hiddenFromCompanies: [], // Anna Verdi visibile a tutti
      hiddenFields: {}
    },
    {
      crewId: 'crew-3',
      isPublicProfile: false, // Luca Bianchi profilo privato
      hiddenFromCompanies: ['company-1', 'company-2'],
      hiddenFields: {
        'company-1': ['hourlyRate', 'phone', 'address', 'availability'],
        'company-2': ['hourlyRate', 'experience', 'phone', 'address', 'skills', 'bio']
      }
    }
  ]);

  const [calendarSyncs, setCalendarSyncs] = useState<CalendarSync[]>([
    {
      userId: 'crew-1',
      userType: 'crew',
      busyDates: [
        {
          date: '2025-03-15',
          eventId: 'event-1',
          companyId: 'company-1',
          type: 'freelance_assignment',
          title: 'Fiera Milano',
          isVisible: true
        },
        {
          date: '2025-03-20',
          type: 'personal_busy',
          title: 'Impegno Personale',
          isVisible: false // Non visibile alle aziende
        }
      ],
      sharedWith: []
    },
    {
      userId: 'crew-2',
      userType: 'crew',
      busyDates: [
        {
          date: '2025-03-12',
          eventId: 'event-2',
          companyId: 'company-1',
          type: 'company_event',
          title: 'Inventario Magazzino',
          isVisible: true
        }
      ],
      sharedWith: ['company-1'] // Dipendente, calendario condiviso con azienda
    }
  ]);

  const addCrewPrivacy = (settings: CrewPrivacySettings) => {
    setCrewPrivacySettings(prev => [...prev, settings]);
  };

  const updateCrewPrivacy = (crewId: string, settings: Partial<CrewPrivacySettings>) => {
    setCrewPrivacySettings(prev => 
      prev.map(privacy => 
        privacy.crewId === crewId 
          ? { ...privacy, ...settings }
          : privacy
      )
    );
  };

  const hideFromCompany = (crewId: string, companyId: string, hiddenFields: PrivacyField[] = []) => {
    setCrewPrivacySettings(prev => 
      prev.map(privacy => {
        if (privacy.crewId === crewId) {
          const updatedHiddenFromCompanies = privacy.hiddenFromCompanies.includes(companyId)
            ? privacy.hiddenFromCompanies
            : [...privacy.hiddenFromCompanies, companyId];
          
          const updatedHiddenFields = {
            ...privacy.hiddenFields,
            [companyId]: hiddenFields.length > 0 ? hiddenFields : ['hourlyRate', 'phone'] // Default hidden fields
          };

          return {
            ...privacy,
            hiddenFromCompanies: updatedHiddenFromCompanies,
            hiddenFields: updatedHiddenFields
          };
        }
        return privacy;
      })
    );

    // Send notification
    sendPrivacyNotification(crewId, 'privacy_update', {
      action: 'hidden_from_company',
      companyId,
      hiddenFields
    });
  };

  const unhideFromCompany = (crewId: string, companyId: string) => {
    setCrewPrivacySettings(prev => 
      prev.map(privacy => {
        if (privacy.crewId === crewId) {
          const updatedHiddenFromCompanies = privacy.hiddenFromCompanies.filter(id => id !== companyId);
          const updatedHiddenFields = { ...privacy.hiddenFields };
          delete updatedHiddenFields[companyId];

          return {
            ...privacy,
            hiddenFromCompanies: updatedHiddenFromCompanies,
            hiddenFields: updatedHiddenFields
          };
        }
        return privacy;
      })
    );

    // Send notification
    sendPrivacyNotification(crewId, 'privacy_update', {
      action: 'unhidden_from_company',
      companyId
    });
  };

  const getVisibleCrewForCompany = (companyId: string): string[] => {
    return crewPrivacySettings
      .filter(privacy => 
        privacy.isPublicProfile && 
        !privacy.hiddenFromCompanies.includes(companyId)
      )
      .map(privacy => privacy.crewId);
  };

  const isCrewVisibleToCompany = (crewId: string, companyId: string): boolean => {
    const privacy = crewPrivacySettings.find(p => p.crewId === crewId);
    if (!privacy) return true; // Default visible if no privacy settings
    
    return privacy.isPublicProfile && !privacy.hiddenFromCompanies.includes(companyId);
  };

  const getHiddenFieldsForCompany = (crewId: string, companyId: string): PrivacyField[] => {
    const privacy = crewPrivacySettings.find(p => p.crewId === crewId);
    if (!privacy) return [];
    
    return privacy.hiddenFields[companyId] || [];
  };

  const syncCrewCalendar = (crewId: string, eventDate: string, eventId: string, companyId: string) => {
    setCalendarSyncs(prev => 
      prev.map(sync => {
        if (sync.userId === crewId) {
          const newBusyDate = {
            date: eventDate,
            eventId,
            companyId,
            type: 'freelance_assignment' as const,
            title: `Evento ${eventId}`,
            isVisible: true
          };

          return {
            ...sync,
            busyDates: [...sync.busyDates, newBusyDate]
          };
        }
        return sync;
      })
    );

    // Send notification to crew
    sendPrivacyNotification(crewId, 'calendar_sync', {
      eventDate,
      eventId,
      companyId,
      message: 'Il tuo calendario è stato aggiornato con un nuovo evento'
    });
  };

  const getCrewBusyDates = (crewId: string): string[] => {
    const sync = calendarSyncs.find(s => s.userId === crewId);
    return sync ? sync.busyDates.map(bd => bd.date) : [];
  };

  const isCrewAvailableOnDate = (crewId: string, date: string): boolean => {
    const busyDates = getCrewBusyDates(crewId);
    return !busyDates.includes(date);
  };

  const sendPrivacyNotification = (crewId: string, type: 'calendar_sync' | 'privacy_update', data: any) => {
    // In real app, this would send actual notifications
    console.log('📧 Privacy Notification:', {
      to: crewId,
      type,
      data,
      timestamp: new Date()
    });
  };

  return (
    <PrivacyContext.Provider value={{
      crewPrivacySettings,
      addCrewPrivacy,
      updateCrewPrivacy,
      hideFromCompany,
      unhideFromCompany,
      getVisibleCrewForCompany,
      isCrewVisibleToCompany,
      getHiddenFieldsForCompany,
      calendarSyncs,
      syncCrewCalendar,
      getCrewBusyDates,
      isCrewAvailableOnDate,
      sendPrivacyNotification
    }}>
      {children}
    </PrivacyContext.Provider>
  );
};