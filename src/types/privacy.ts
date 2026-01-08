export interface CrewPrivacySettings {
  crewId: string;
  isPublicProfile: boolean;
  hiddenFromCompanies: string[]; // Array di company IDs
  hiddenFields: {
    [companyId: string]: PrivacyField[];
  };
}

export type PrivacyField = 
  | 'hourlyRate' 
  | 'experience' 
  | 'phone' 
  | 'address' 
  | 'skills' 
  | 'bio' 
  | 'availability' 
  | 'enpalsStatus'
  | 'rating'
  | 'eventsHistory';

export interface CompanyCrewVisibility {
  companyId: string;
  visibleFreelance: string[]; // Freelance che non si sono nascosti
  employees: string[]; // Solo i propri dipendenti
  blockedBy: string[]; // Freelance che hanno bloccato questa azienda
}

export interface CalendarSync {
  userId: string;
  userType: 'company' | 'crew';
  busyDates: CalendarBusyDate[];
  sharedWith: string[]; // Per dipendenti: condiviso con la loro azienda
}

export interface CalendarBusyDate {
  date: string;
  eventId?: string;
  companyId?: string;
  type: 'company_event' | 'personal_busy' | 'holiday' | 'freelance_assignment';
  title?: string;
  isVisible: boolean; // Se visibile ad altri (es. azienda vede crew occupato)
}

export interface CrewVisibilityFilter {
  showEmployeesOnly: boolean;
  showFreelanceOnly: boolean;
  showAvailableOnly: boolean;
  hideBlockedFreelance: boolean;
  skillsFilter: string[];
  experienceMin?: number;
  rateRange?: {
    min: number;
    max: number;
  };
}