import { useState } from 'react';
import { useExpenseManager } from './hooks/useExpenseManager';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { TransactionModal } from './components/TransactionModal';
import { ReceiptScanModal } from './components/ReceiptScanModal';
import { RoommateSplitModal } from './components/RoommateSplitModal';
import { LedgerManagerModal } from './components/LedgerManagerModal';
import { WalletManagerModal } from './components/WalletManagerModal';
import { WalletTransferModal } from './components/WalletTransferModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { DataBackupModal } from './components/DataBackupModal';
import { Transaction } from './types';
import {
  Plus,
  Camera,
  Users,
  Wallet as WalletIcon,
  Sliders,
} from 'lucide-react';

export function App() {
  const manager = useExpenseManager();

  // Modals visibility state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isReceiptScanModalOpen, setIsReceiptScanModalOpen] = useState(false);
  const [isRoommateSplitModalOpen, setIsRoommateSplitModalOpen] = useState(false);
  const [isLedgerManagerModalOpen, setIsLedgerManagerModalOpen] = useState(false);
  const [isWalletManagerModalOpen, setIsWalletManagerModalOpen] = useState(false);
  const [isWalletTransferModalOpen, setIsWalletTransferModalOpen] = useState(false);
  const [isCategoryManagerModalOpen, setIsCategoryManagerModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Quick Open Handlers
  const handleOpenNewTransaction = () => {
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  const handleSaveTransaction = (
    data: Omit<Transaction, 'id' | 'createdAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      manager.updateTransaction(editingId, data);
    } else {
      manager.addTransaction(data);
    }
  };

  const handleApplyReceiptToTransaction = (receiptData: {
    amount: number;
    categoryId: string;
    note: string;
    date: string;
  }) => {
    setEditingTransaction({
      id: '',
      amount: receiptData.amount,
      type: 'expense',
      date: receiptData.date,
      categoryId: receiptData.categoryId,
      note: receiptData.note,
      ledgerId: manager.activeLedgerId === 'all' ? (manager.ledgers[0]?.id || 'ledger-personal') : manager.activeLedgerId,
      walletId: manager.activeWalletId === 'all' ? (manager.wallets[0]?.id || 'wallet-cash') : manager.activeWalletId,
      createdAt: new Date().toISOString(),
    });
    setIsTransactionModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col selection:bg-[#ecd9c2]">
      {/* Sticky App Header with Ledger Switcher */}
      <Header
        ledgers={manager.ledgers}
        activeLedgerId={manager.activeLedgerId}
        onSelectLedger={manager.setActiveLedgerId}
        onOpenLedgerManager={() => setIsLedgerManagerModalOpen(true)}
        onOpenReceiptScan={() => setIsReceiptScanModalOpen(true)}
        onOpenRoommateSplit={() => setIsRoommateSplitModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenNewTransaction={handleOpenNewTransaction}
      />

      {/* Main Content Container */}
      <main className="max-w-4xl w-full mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-6 flex-1 pb-24">
        {/* Notebook Cover Subtitle / Welcome Banner */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-[#7a6a58]">
            <span className="w-2 h-2 rounded-full bg-[#a25832]" />
            <span className="font-serif italic">
              Đang xem sổ:{' '}
              <strong className="text-[#3e332a] not-italic">
                {manager.activeLedgerId === 'all'
                  ? 'Tất cả các sổ chi tiêu'
                  : manager.ledgers.find((l) => l.id === manager.activeLedgerId)?.name || 'Cá nhân'}
              </strong>
            </span>
          </div>

          <button
            onClick={() => setIsLedgerManagerModalOpen(true)}
            className="text-xs text-[#a25832] font-semibold hover:underline"
          >
            Đổi hoặc tạo sổ mới →
          </button>
        </div>

        {/* Dashboard Statistics & Wallet Selector */}
        <Dashboard
          stats={manager.stats}
          timeFilter={manager.timeFilter}
          onChangeTimeFilter={manager.setTimeFilter}
          wallets={manager.wallets}
          walletBalances={manager.walletBalances}
          activeWalletId={manager.activeWalletId}
          onSelectWallet={manager.setActiveWalletId}
          includeAllWallets={manager.includeAllWallets}
          onToggleIncludeAllWallets={manager.setIncludeAllWallets}
          categoryBreakdown={manager.categoryBreakdown}
          onOpenTransferModal={() => setIsWalletTransferModalOpen(true)}
          onOpenWalletManager={() => setIsWalletManagerModalOpen(true)}
        />

        {/* Transaction History Journal */}
        <TransactionList
          transactions={manager.filteredTransactions}
          ledgers={manager.ledgers}
          wallets={manager.wallets}
          categories={manager.categories}
          searchQuery={manager.searchQuery}
          onSearchChange={manager.setSearchQuery}
          typeFilter={manager.typeFilter}
          onTypeFilterChange={manager.setTypeFilter}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={manager.deleteTransaction}
          onOpenNewTransaction={handleOpenNewTransaction}
          onOpenReceiptScan={() => setIsReceiptScanModalOpen(true)}
        />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#fffdfa]/95 backdrop-blur-md border-t border-[#ebdcc9] py-2 px-4 sm:hidden safe-bottom shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Quick Wallets */}
          <button
            onClick={() => setIsWalletManagerModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[#7a6a58] hover:text-[#3e332a] transition"
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Ví tiền</span>
          </button>

          {/* Quick Scan */}
          <button
            onClick={() => setIsReceiptScanModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[#7a6a58] hover:text-[#3e332a] transition"
          >
            <Camera className="w-5 h-5 text-[#a25832]" />
            <span className="text-[10px] font-medium">Quét HĐ</span>
          </button>

          {/* Floating Center Add Button */}
          <button
            onClick={handleOpenNewTransaction}
            className="-mt-5 w-12 h-12 rounded-full bg-[#a25832] text-white flex items-center justify-center shadow-lg active:scale-95 transition border-2 border-[#fffdfa]"
            title="Thêm giao dịch"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Quick Room Split */}
          <button
            onClick={() => setIsRoommateSplitModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[#7a6a58] hover:text-[#3e332a] transition"
          >
            <Users className="w-5 h-5 text-[#3d7a5a]" />
            <span className="text-[10px] font-medium">Chia trọ</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[#7a6a58] hover:text-[#3e332a] transition"
          >
            <Sliders className="w-5 h-5" />
            <span className="text-[10px] font-medium">Cài đặt</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Button on Desktop */}
      <div className="hidden sm:block fixed bottom-6 right-6 z-30">
        <button
          onClick={handleOpenNewTransaction}
          className="px-5 py-3 rounded-full bg-[#a25832] hover:bg-[#8c4623] active:scale-95 text-white font-semibold text-sm shadow-paper-lg transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Ghi chép mới</span>
        </button>
      </div>

      {/* Modals */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
        ledgers={manager.ledgers}
        wallets={manager.wallets}
        categories={manager.categories}
        initialLedgerId={manager.activeLedgerId}
        initialWalletId={manager.activeWalletId}
      />

      <ReceiptScanModal
        isOpen={isReceiptScanModalOpen}
        onClose={() => setIsReceiptScanModalOpen(false)}
        onApplyReceipt={handleApplyReceiptToTransaction}
      />

      <RoommateSplitModal
        isOpen={isRoommateSplitModalOpen}
        onClose={() => setIsRoommateSplitModalOpen(false)}
        ledgers={manager.ledgers}
        wallets={manager.wallets}
        onAddTransaction={(tx) => manager.addTransaction(tx)}
      />

      <LedgerManagerModal
        isOpen={isLedgerManagerModalOpen}
        onClose={() => setIsLedgerManagerModalOpen(false)}
        ledgers={manager.ledgers}
        activeLedgerId={manager.activeLedgerId}
        onSelectLedger={manager.setActiveLedgerId}
        onAddLedger={manager.addLedger}
        onUpdateLedger={manager.updateLedger}
        onDeleteLedger={manager.deleteLedger}
      />

      <WalletManagerModal
        isOpen={isWalletManagerModalOpen}
        onClose={() => setIsWalletManagerModalOpen(false)}
        wallets={manager.wallets}
        walletBalances={manager.walletBalances}
        onAddWallet={manager.addWallet}
        onUpdateWallet={manager.updateWallet}
        onDeleteWallet={manager.deleteWallet}
        onOpenTransferModal={() => setIsWalletTransferModalOpen(true)}
      />

      <WalletTransferModal
        isOpen={isWalletTransferModalOpen}
        onClose={() => setIsWalletTransferModalOpen(false)}
        wallets={manager.wallets}
        walletBalances={manager.walletBalances}
        onTransfer={manager.transferMoney}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerModalOpen}
        onClose={() => setIsCategoryManagerModalOpen(false)}
        categories={manager.categories}
        onAddCategory={manager.addCategory}
        onUpdateCategory={manager.updateCategory}
        onDeleteCategory={manager.deleteCategory}
      />

      <DataBackupModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onExport={manager.exportDataJson}
        onImport={manager.importDataJson}
        onReset={manager.resetToDefaults}
        onOpenCategoryManager={() => setIsCategoryManagerModalOpen(true)}
      />
    </div>
  );
}

export default App;
