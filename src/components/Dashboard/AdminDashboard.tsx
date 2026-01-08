import React from 'react';
import { Users, Building2, Calendar, TrendingUp, UserCheck, AlertCircle } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const stats = [
    {
      title: 'Aziende Registrate',
      value: '12',
      change: '+2 questo mese',
      icon: Building2,
      color: 'bg-blue-500'
    },
    {
      title: 'Crew Attivi',
      value: '48',
      change: '+8 questo mese',
      icon: Users,
      color: 'bg-green-500'
    },
    {
      title: 'Eventi Totali',
      value: '156',
      change: '+23 questo mese',
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      title: 'Approvazioni Pending',
      value: '5',
      change: '3 aziende, 2 crew',
      icon: UserCheck,
      color: 'bg-orange-500'
    }
  ];

  const recentActivity = [
    { type: 'company', message: 'Nuova azienda registrata: EventPro SRL', time: '2 ore fa' },
    { type: 'crew', message: 'Nuovo crew member: Mario Rossi', time: '4 ore fa' },
    { type: 'approval', message: 'Approvata azienda: TechEvents', time: '1 giorno fa' },
    { type: 'event', message: 'Evento completato: Fiera Milano', time: '2 giorni fa' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Amministratore</h1>
        <p className="text-gray-600">Panoramica generale del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">{stat.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attività Recenti</h3>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Approvazioni in Attesa</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">EventPro SRL</p>
                  <p className="text-xs text-gray-500">Azienda - Registrata oggi</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                  Approva
                </button>
                <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                  Rifiuta
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Luca Bianchi</p>
                  <p className="text-xs text-gray-500">Crew Freelance - Registrato ieri</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                  Approva
                </button>
                <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                  Rifiuta
                </button>
              </div>
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

export default AdminDashboard;