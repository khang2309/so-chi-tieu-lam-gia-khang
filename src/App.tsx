import { useState } from 'react';
import { useExpenseManager } from './hooks/useExpenseManager';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { TransactionModal } from './components/TransactionModal';
import { VoiceInputModal } from './components/VoiceInputModal';
import { ReceiptScanModal } from './components/ReceiptScanModal';
import { RoommateSplitModal } from './components/RoommateSplitModal';
import { DuplicateTransactionModal } from './components/DuplicateTransactionModal';
import { LedgerManagerModal } from './components/LedgerManagerModal';
import { WalletManagerModal } from './components/WalletManagerModal';
import { WalletTransferModal } from './components/WalletTransferModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { DataBackupModal } from './components/DataBackupModal';
import { AuthModal } from './components/AuthModal';
import { WalletTab } from './components/WalletTab';
import { exportTransactionsToExcel } from './utils/excelExporter';
import { Transaction } from './types';
import { ParsedVoiceResult } from './utils/voiceParser';
import {
  Plus,
  Camera,
  Wallet as WalletIcon,
  Receipt,
  Mic,
} from 'lucide-react';

export function App() {
  const manager = useExpenseManager();

  // Modals visibility state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [voiceInitialValues, setVoiceInitialValues] = useState<Partial<Omit<Transaction, 'id' | 'createdAt'>> | null>(null);

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState<Transaction | null>(null);

  const [isReceiptScanModalOpen, setIsReceiptScanModalOpen] = useState(false);
  const [isRoommateSplitModalOpen, setIsRoommateSplitModalOpen] = useState(false);
  const [isLedgerManagerModalOpen, setIsLedgerManagerModalOpen] = useState(false);
  const [isWalletManagerModalOpen, setIsWalletManagerModalOpen] = useState(false);
  const [isWalletTransferModalOpen, setIsWalletTransferModalOpen] = useState(false);
  const [isCategoryManagerModalOpen, setIsCategoryManagerModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'wallets'>('dashboard');

  // Quick Open Handlers
  const handleOpenNewTransaction = () => {
    setEditingTransaction(null);
    setVoiceInitialValues(null);
    setIsTransactionModalOpen(true);
  };

  const handleOpenVoiceInput = () => {
    setIsVoiceModalOpen(true);
  };

  const handleVoiceParsedResult = (parsed: ParsedVoiceResult) => {
    setVoiceInitialValues({
      amount: parsed.amount,
      note: parsed.note,
      categoryId: parsed.categoryId,
      type: parsed.type,
    });
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  const handleDuplicateTransaction = (tx: Transaction) => {
    setDuplicatingTransaction(tx);
    setIsDuplicateModalOpen(true);
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


  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col selection:bg-[#ecd9c2]">
      {/* Sticky App Header with Ledger Switcher */}
      <Header
        ledgers={manager.ledgers}
        activeLedgerId={manager.activeLedgerId}
        onSelectLedger={manager.setActiveLedgerId}
        onOpenLedgerManager={() => setIsLedgerManagerModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenRoommateSplit={() => setIsRoommateSplitModalOpen(true)}
        isAutoSyncing={manager.isAutoSyncing}
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

        {/* View Mode Tabs: [Sổ Chi Tiêu] / [Quản Lý Ví] */}
        <div className="flex items-center gap-2 border-b border-[#ebdcc9] pb-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'bg-[#a25832] text-white shadow-xs'
                : 'bg-[#fffdfa] text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Sổ Chi Tiêu & Nhật Ký</span>
          </button>

          <button
            onClick={() => setActiveTab('wallets')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'wallets'
                ? 'bg-[#a25832] text-white shadow-xs'
                : 'bg-[#fffdfa] text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
            }`}
          >
            <WalletIcon className="w-4 h-4" />
            <span>Quản Lý Ví ({manager.wallets.length})</span>
          </button>
        </div>

        {/* Banner Nhập Giọng Nói Tiện Lợi */}
        {activeTab === 'dashboard' && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-[#fff7ed] to-[#fbf5eb] border border-[#fed7aa] flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#ea580c] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Mic className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5">
                  <span>Nhập chi tiêu bằng giọng nói</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#ea580c] text-white font-bold uppercase">Mới</span>
                </div>
                <div className="text-[11px] text-[#7a6a58] truncate">
                  Đọc nhanh: <em>"Đổ xăng 50k"</em>, <em>"Cơm trưa 35 nghìn"</em>
                </div>
              </div>
            </div>
            <button
              onClick={handleOpenVoiceInput}
              className="px-3 py-1.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] active:scale-95 text-white text-xs font-bold shrink-0 shadow-xs transition flex items-center gap-1"
            >
              <span>Đọc lệnh</span>
            </button>
          </div>
        )}

        {activeTab === 'dashboard' ? (
          <>
            {/* 1. ĐẨY NHẬT KÝ GIAO DỊCH LÊN ĐẦU: Đập vào mắt người dùng ngay lập tức */}
            <TransactionList
              transactions={manager.transactions.filter(
                (tx) =>
                  !tx.isDeleted &&
                  (manager.activeLedgerId === 'all' || tx.ledgerId === manager.activeLedgerId)
              )}
              activeLedgerId={manager.activeLedgerId}
              activeLedgerName={
                manager.activeLedgerId === 'all'
                  ? 'Tất cả các sổ'
                  : manager.ledgers.find((l) => l.id === manager.activeLedgerId)?.name
              }
              ledgers={manager.ledgers}
              wallets={manager.wallets}
              categories={manager.categories}
              searchQuery={manager.searchQuery}
              onSearchChange={manager.setSearchQuery}
              typeFilter={manager.typeFilter}
              onTypeFilterChange={manager.setTypeFilter}
              onEditTransaction={handleEditTransaction}
              onDuplicateTransaction={handleDuplicateTransaction}
              onDeleteTransaction={manager.deleteTransaction}
              onOpenNewTransaction={handleOpenNewTransaction}
              onOpenReceiptScan={() => setIsReceiptScanModalOpen(true)}
            />

            {/* 2. Phân bổ chi tiêu theo danh mục (đặt phía dưới nhật ký) */}
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
          </>
        ) : (
          <WalletTab
            wallets={manager.wallets}
            walletBalances={manager.walletBalances}
            totalBalance={manager.totalAllWalletsBalance}
            onAddWallet={manager.addWallet}
            onUpdateWallet={manager.updateWallet}
            onDeleteWallet={manager.deleteWallet}
            onOpenTransferModal={() => setIsWalletTransferModalOpen(true)}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#fffdfa]/95 backdrop-blur-md border-t border-[#ebdcc9] py-1.5 px-2 safe-bottom shadow-lg">
        <div className="grid grid-cols-5 items-center max-w-md mx-auto relative">
          {/* Nút 1 (Bên trái 1): Sổ cái / Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition ${
              activeTab === 'dashboard'
                ? 'text-[#a25832] font-bold'
                : 'text-[#7a6a58] hover:text-[#3e332a]'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[11px] leading-tight font-medium">Sổ cái</span>
          </button>

          {/* Nút 2 (Bên trái 2): Ví tiền */}
          <button
            onClick={() => setActiveTab('wallets')}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition ${
              activeTab === 'wallets'
                ? 'text-[#a25832] font-bold'
                : 'text-[#7a6a58] hover:text-[#3e332a]'
            }`}
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-[11px] leading-tight font-medium">Ví tiền</span>
          </button>

          {/* Nút 3 (CĂN GIỮA TUYỆT ĐỐI): Micro Floating Action Button (Màu cam nổi bật) */}
          <div className="flex flex-col items-center justify-center relative">
            <button
              onClick={handleOpenVoiceInput}
              className="-mt-7 w-14 h-14 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] hover:from-[#c2410c] hover:to-[#ea580c] text-white flex items-center justify-center shadow-lg active:scale-95 transition-all border-4 border-[#fffdfa] ring-2 ring-[#ea580c]/30 group"
              title="Đọc hóa đơn bằng giọng nói"
            >
              <Mic className="w-6 h-6 animate-pulse group-hover:scale-110 transition" />
            </button>
            <span className="text-[10px] font-bold text-[#ea580c] mt-0.5 leading-tight">Giọng nói</span>
          </div>

          {/* Nút 4 (Bên phải 1): Quét Hóa Đơn */}
          <button
            onClick={() => setIsReceiptScanModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[#7a6a58] hover:text-[#3e332a] transition"
            title="Quét hóa đơn AI"
          >
            <Camera className="w-5 h-5 text-[#a25832]" />
            <span className="text-[11px] font-medium leading-tight">Quét HĐ</span>
          </button>

          {/* Nút 5 (Bên phải 2): Thêm giao dịch thủ công */}
          <button
            onClick={handleOpenNewTransaction}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[#7a6a58] hover:text-[#3e332a] transition"
            title="Thêm thủ công"
          >
            <Plus className="w-5 h-5 text-[#a25832]" />
            <span className="text-[11px] font-medium leading-tight">Thêm tay</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Button on Desktop */}
      <div className="hidden sm:flex fixed bottom-6 right-6 z-30 items-center gap-2.5">
        <button
          onClick={handleOpenVoiceInput}
          className="px-4 py-3 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] hover:brightness-105 active:scale-95 text-white font-semibold text-sm shadow-paper-lg transition flex items-center gap-2"
          title="Đọc hóa đơn bằng giọng nói"
        >
          <Mic className="w-5 h-5 animate-pulse" />
          <span>Nói để ghi</span>
        </button>
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
        onClose={() => {
          setIsTransactionModalOpen(false);
          setVoiceInitialValues(null);
        }}
        onSave={(data, id) => {
          handleSaveTransaction(data, id);
          setVoiceInitialValues(null);
        }}
        editingTransaction={editingTransaction}
        initialValues={voiceInitialValues}
        ledgers={manager.ledgers}
        wallets={manager.wallets}
        categories={manager.categories}
        initialLedgerId={manager.activeLedgerId}
        initialWalletId={manager.activeWalletId}
        existingTransactions={manager.transactions}
        onOpenVoiceModal={() => {
          setIsTransactionModalOpen(false);
          setIsVoiceModalOpen(true);
        }}
      />

      {/* Voice Recognition Modal */}
      <VoiceInputModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        categories={manager.categories}
        onParsedResult={handleVoiceParsedResult}
      />

      <ReceiptScanModal
        isOpen={isReceiptScanModalOpen}
        onClose={() => setIsReceiptScanModalOpen(false)}
        ledgers={manager.ledgers}
        wallets={manager.wallets}
        categories={manager.categories}
        activeLedgerId={manager.activeLedgerId}
        onSaveBatchTransactions={(items) => manager.addBatchTransactions(items)}
      />

      <RoommateSplitModal
        isOpen={isRoommateSplitModalOpen}
        onClose={() => setIsRoommateSplitModalOpen(false)}
        ledgers={manager.ledgers}
        wallets={manager.wallets}
        onAddTransaction={(tx) => manager.addTransaction(tx)}
        onAddBatchTransactions={(items) => manager.addBatchTransactions(items)}
      />

      <DuplicateTransactionModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        sourceTransaction={duplicatingTransaction}
        ledgers={manager.ledgers}
        wallets={manager.wallets}
        categories={manager.categories}
        onConfirm={(data) => manager.addTransaction(data)}
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
        onExportExcel={() => {
          exportTransactionsToExcel(
            manager.transactions.filter((tx) => !tx.isDeleted),
            manager.categories,
            manager.ledgers,
            manager.wallets,
            `Chi_Tieu_Toan_Bo_${new Date().toISOString().slice(0, 10)}.xlsx`
          );
        }}
        onImport={manager.importDataJson}
        onReset={manager.resetToDefaults}
        onClearUserData={manager.clearUserData}
        onOpenCategoryManager={() => setIsCategoryManagerModalOpen(true)}
        onSyncToCloud={manager.syncToCloud}
      />

      {/* Firebase Auth & Offline First Modal */}
      <AuthModal />
    </div>
  );
}

export default App;
