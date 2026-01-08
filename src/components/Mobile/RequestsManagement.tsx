import React, { useEffect, useState } from 'react';
import FeriePermessi from './FeriePermessi';
import NoteSpese from './NoteSpese';
import Straordinari from './Straordinari';
import RiepilogoRichieste from './RiepilogoRichieste';
import { Calendar, FileText, Clock, List } from 'lucide-react';

/**
 * RequestsManagement - improved mobile responsiveness
 *
 * Changes:
 * - Top navigation is always visible and horizontally scrollable on small screens (no hidden nav).
 * - Bottom sticky nav kept for convenience but made more prominent and accessible.
 * - On section change the container scrolls to top so mobile users see the section header.
 * - Increased touch target sizes and spacing for mobile.
 * - Content container is full width on mobile and centered with max width on larger screens.
 *
 * This file is the single source of truth for switching sections; child components remain unchanged
 * but are displayed in a mobile-friendly container.
 */

type Section = 'ferie' | 'spese' | 'straordinari' | 'riepilogo';

const navItems: { key: Section; label: string; Icon: any }[] = [
  { key: 'ferie', label: 'Ferie', Icon: Calendar },
  { key: 'spese', label: 'Spese', Icon: FileText },
  { key: 'straordinari', label: 'Ore', Icon: Clock },
  { key: 'riepilogo', label: 'Riepilogo', Icon: List }
];

const RequestsManagement: React.FC = () => {
  const [active, setActive] = useState<Section>('ferie');

  // Ensure focus / scroll to top when switching sections on mobile
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [active]);

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-semibold leading-tight">Richieste</h1>
            <p className="text-xs md:text-sm text-gray-400 mt-0.5">Gestisci ferie, note spese, straordinari e riepiloghi</p>
          </div>

          {/* Desktop actions can remain here if needed */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="text-sm text-gray-400"> </div>
          </div>
        </div>

        {/* Top navigation: always visible, horizontally scrollable on small screens */}
        <nav className="overflow-x-auto no-scrollbar">
          <div className="max-w-4xl mx-auto px-2 py-2 flex items-center space-x-2">
            {navItems.map((n) => {
              const isActive = active === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setActive(n.key)}
                  className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow' : 'bg-gray-800 text-gray-200'
                  }`}
                  aria-pressed={isActive}
                >
                  <n.Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{n.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="pb-28 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-4 space-y-6">
          {active === 'ferie' && (
            <section>
              <FeriePermessi />
            </section>
          )}

          {active === 'spese' && (
            <section>
              <NoteSpese />
            </section>
          )}

          {active === 'straordinari' && (
            <section>
              <Straordinari />
            </section>
          )}

          {active === 'riepilogo' && (
            <section>
              <RiepilogoRichieste />
            </section>
          )}
        </div>
      </main>

      {/* Bottom sticky nav - visible on mobile but still useful on larger screens */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-2">
          <div className="flex justify-between items-center">
            {navItems.map((n) => {
              const isActive = active === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setActive(n.key)}
                  className={`w-full py-3 flex flex-col items-center text-xs ${isActive ? 'text-white' : 'text-gray-400'} focus:outline-none`}
                  aria-pressed={isActive}
                >
                  <n.Icon className="h-5 w-5" />
                  <span className="mt-1">{n.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default RequestsManagement;