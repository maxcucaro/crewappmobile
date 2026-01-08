  import React from 'react';
import { Plus } from 'lucide-react';

interface ExpenseReimbursementProps {
  showNewExpenseButton?: boolean;
  onOpenNewExpense?: () => void;
}

/**
 * ExpenseReimbursement
 * - lightweight summary box for expenses section
 * - shows its own "Nuova Nota Spesa" button only when showNewExpenseButton is true
 * - parent (MobileExpenses) will pass showNewExpenseButton={false} to avoid duplicates
 */
const ExpenseReimbursement: React.FC<ExpenseReimbursementProps> = ({ showNewExpenseButton = true, onOpenNewExpense }) => {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">Rimborso Spese Sostenute</h3>
          <p className="text-gray-300 text-sm">Invia le note spese per ottenere il rimborso delle spese sostenute durante eventi o turni di magazzino.</p>
        </div>

        {showNewExpenseButton && (
          <div>
            <button
              onClick={() => {
                // prefer parent to handle opening (if provided), else do nothing
                if (onOpenNewExpense) onOpenNewExpense();
              }}
              className="bg-gradient-to-r from-green-600 to-emerald-500 text-white py-2 px-4 rounded-xl font-semibold flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Nuova Nota Spesa</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseReimbursement;