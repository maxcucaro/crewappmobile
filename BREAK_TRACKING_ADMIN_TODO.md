# Admin View Indicators for Break Status - TODO

## Obiettivo
Quando verrà creata una dashboard admin/company per visualizzare i warehouse check-ins,
dovranno essere aggiunti questi indicatori visivi per lo stato delle pause pranzo:

## Indicatori da Implementare

### 1. Icona Verde ✅ - Pausa Regolare
**Condizione**: `break_registered_late = false AND break_auto_applied = false`
- Pausa registrata normalmente durante il turno
- GPS tracciato per inizio e fine pausa
- Nessun problema

### 2. Icona Gialla ⚠️ - Pausa Inserita in Ritardo
**Condizione**: `break_registered_late = true`
- Dipendente ha inserito la pausa dopo il check-out
- Entro le 8 ore consentite
- GPS non disponibile (inserita manualmente)
- Mostrare tooltip: "Pausa inserita il {break_modified_at}"

### 3. Icona Rossa 🔴 - Pausa Auto-Applicata
**Condizione**: `break_auto_applied = true`
- Sistema ha applicato automaticamente 60 minuti dopo 8 ore
- Dipendente non ha registrato la pausa
- Orari inizio/fine non disponibili
- Mostrare tooltip: "Pausa applicata automaticamente dal sistema"

## Esempio Query per Dashboard Admin

```typescript
// Recupera warehouse check-ins con indicatori pausa
const { data: checkins } = await supabase
  .from('warehouse_checkins')
  .select(`
    *,
    crew_members!crew_id(full_name, email)
  `)
  .eq('has_checked_out', true)
  .order('date', { ascending: false });

// Per ogni check-in, mostra l'indicatore appropriato
checkins.forEach(checkin => {
  if (checkin.pausa_pranzo) {
    if (checkin.break_auto_applied) {
      // 🔴 Icona rossa - Auto-applicata
      return <AlertTriangle className="text-red-500" />;
    } else if (checkin.break_registered_late) {
      // ⚠️ Icona gialla - Inserita in ritardo
      return <AlertCircle className="text-yellow-500" />;
    } else {
      // ✅ Icona verde - Tutto ok
      return <CheckCircle className="text-green-500" />;
    }
  }
});
```

## Componenti da Aggiornare

Quando verranno creati/aggiornati questi componenti:

1. **AdminDashboard.tsx** - Dashboard principale admin
2. **CompanyDashboard.tsx** - Dashboard azienda
3. **WarehouseCheckinsReport.tsx** - Report check-in magazzino (da creare)
4. **TimesheetManagement.tsx** - Gestione ore lavorate

## Colonne Tabella Suggerita

| Dipendente | Data | Check-in | Check-out | Ore Totali | Pausa | Stato Pausa | Note |
|------------|------|----------|-----------|------------|-------|-------------|------|
| Mario Rossi | 08/10/2025 | 08:00 | 17:00 | 9h | 60 min | ✅ Regolare | - |
| Luigi Verdi | 08/10/2025 | 09:00 | 18:00 | 9h | 60 min | ⚠️ In ritardo | Inserita alle 19:30 |
| Anna Bianchi | 08/10/2025 | 08:30 | 17:30 | 9h | 60 min | 🔴 Auto-applicata | Non registrata |

## Note Implementative

- Gli indicatori dovrebbero essere visibili solo per turni con `pausa_pranzo = true`
- Tooltip deve mostrare dettagli timestamp quando disponibile
- Possibilità di filtrare per stato pausa
- Esportazione report deve includere colonna "Stato Pausa"
