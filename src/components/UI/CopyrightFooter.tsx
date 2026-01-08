import React from 'react';
import { useAppVersion } from '../../hooks/useAppVersion';

export const CopyrightFooter: React.FC = () => {
  const { version } = useAppVersion();

  return (
    <div className="text-center text-gray-500 text-xs">
      <p>© 2025 ControlStage - Crew App Mobile V. {version}</p>
      <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
    </div>
  );
};
