import { useState, useEffect } from 'react';
import { useExpenseManager } from './hooks/useExpenseManager';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { ReportScreen } from './components/ReportScreen';
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
  BarChart3,
  Users,
} from 'lucide-react';

export function App() {
  const manager = useExpenseManager();
  const { user, loading: authLoading, openAuthModal } = useAuth();

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

  // Search & Filter & Speed Dial states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isCategoryFilterSheetOpen, setIsCategoryFilterSheetOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'wallets'>('dashboard');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    };
    window.addEventListener('show-app-toast', handleToast);
    return () => window.removeEventListener('show-app-toast', handleToast);
  }, []);

  // 1. Logic kiểm tra "Lần đầu mở App" (Chỉ mở AuthModal 1 lần duy nhất)
  useEffect(() => {
    if (authLoading) return;
    const hasSeenLoginPopup = localStorage.getItem('hasSeenLoginPopup');
    if (!hasSeenLoginPopup && !user) {
      openAuthModal();
    }
  }, [authLoading, user, openAuthModal]);

  // 2. Kéo ngay lập tức toàn bộ dữ liệu từ Cloud về NGAY KHI user đăng nhập thành công
  useEffect(() => {
    if (user?.uid) {
      manager.fetchAndSyncUserData(user.uid);
    }
  }, [user?.uid]);

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
      walletId: parsed.walletId,
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
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        searchQuery={manager.searchQuery}
        onSearchChange={manager.setSearchQuery}
        activeTab={activeTab}
        onOpenCategoryFilter={() => setIsCategoryFilterSheetOpen(true)}
        isCategoryFiltered={selectedCategoryId !== 'all'}
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

        {activeTab === 'dashboard' && (
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
            isFilterSheetOpen={isFilterSheetOpen}
            setIsFilterSheetOpen={setIsFilterSheetOpen}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            isCategoryFilterSheetOpen={isCategoryFilterSheetOpen}
            setIsCategoryFilterSheetOpen={setIsCategoryFilterSheetOpen}
          />
        )}

        {activeTab === 'reports' && (
          <ReportScreen
            transactions={manager.transactions}
            categories={manager.categories}
            wallets={manager.wallets}
            ledgers={manager.ledgers}
            activeLedgerId={manager.activeLedgerId}
            activeLedgerName={
              manager.activeLedgerId === 'all'
                ? 'Tất cả các sổ'
                : manager.ledgers.find((l) => l.id === manager.activeLedgerId)?.name
            }
          />
        )}

        {activeTab === 'wallets' && (
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

      {/* Speed Dial Backdrop */}
      {isSpeedDialOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsSpeedDialOpen(false)}
        />
      )}

      {/* Speed Dial Popup */}
      {isSpeedDialOpen && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-64 p-2.5 bg-[#fffdfa] rounded-2xl shadow-2xl border border-[#ebdcc9] animate-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={() => {
              setIsSpeedDialOpen(false);
              handleOpenNewTransaction();
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f6eee3] text-left transition cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#a25832] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#3e332a]">Thêm Tay</div>
              <div className="text-[11px] text-[#7a6a58]">Nhập chi tiết thủ công</div>
            </div>
          </button>

          <button
            onClick={() => {
              setIsSpeedDialOpen(false);
              handleOpenVoiceInput();
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#fff2ea] text-left transition cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-orange-700">Giọng Nói</div>
              <div className="text-[11px] text-[#7a6a58]">Nói tiếng Việt thông minh</div>
            </div>
          </button>

          <button
            onClick={() => {
              setIsSpeedDialOpen(false);
              setIsReceiptScanModalOpen(true);
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-sky-50 text-left transition cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-sky-800">Quét Hoá Đơn</div>
              <div className="text-[11px] text-[#7a6a58]">Chụp & AI trích xuất</div>
            </div>
          </button>
        </div>
      )}

      {/* Bottom Navigation Bar (5 Nút với FAB Trung tâm) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#fffdfa]/95 backdrop-blur-md border-t border-[#ebdcc9] py-1.5 px-2 safe-bottom shadow-lg">
        <div className="grid grid-cols-5 items-center max-w-md mx-auto relative">
          {/* Tab 1: Sổ cái (Trang chủ) */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-[#a25832] font-bold'
                : 'text-[#7a6a58] hover:text-[#3e332a]'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[11px] leading-tight font-medium">Sổ cái</span>
          </button>

          {/* Tab 2: Báo cáo */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
              activeTab === 'reports'
                ? 'text-[#a25832] font-bold'
                : 'text-[#7a6a58] hover:text-[#3e332a]'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[11px] leading-tight font-medium">Báo cáo</span>
          </button>

          {/* Nút FAB Trung tâm (+): Nút hình tròn to, nổi bật */}
          <div className="flex flex-col items-center justify-center relative">
            <button
              onClick={() => setIsSpeedDialOpen((prev) => !prev)}
              className={`-mt-7 w-14 h-14 rounded-full bg-gradient-to-tr from-[#a25832] to-[#c76a3e] hover:from-[#8c4623] hover:to-[#a25832] text-white flex items-center justify-center shadow-lg active:scale-95 transition-all duration-300 border-4 border-[#fffdfa] ring-2 ring-[#a25832]/30 cursor-pointer ${
                isSpeedDialOpen ? 'rotate-45 !bg-[#3e332a]' : ''
              }`}
              title="Thao tác nhanh"
            >
              <Plus className="w-7 h-7" />
            </button>
            <span className="text-[10px] font-bold text-[#a25832] mt-0.5 leading-tight">Thêm mới</span>
          </div>

          {/* Tab 3: Ví tiền */}
          <button
            onClick={() => setActiveTab('wallets')}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
              activeTab === 'wallets'
                ? 'text-[#a25832] font-bold'
                : 'text-[#7a6a58] hover:text-[#3e332a]'
            }`}
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-[11px] leading-tight font-medium">Ví tiền</span>
          </button>

          {/* Tab 4: Chia trọ */}
          <button
            onClick={() => setIsRoommateSplitModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[#7a6a58] hover:text-[#3e332a] transition cursor-pointer"
            title="Chia tiền phòng trọ"
          >
            <Users className="w-5 h-5 text-[#a25832]" />
            <span className="text-[11px] font-medium leading-tight">Chia trọ</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Button on Desktop */}
      <div className="hidden sm:flex fixed bottom-6 right-6 z-30 items-center gap-2.5">
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
      />

      {/* Voice Recognition Modal */}
      <VoiceInputModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        categories={manager.categories}
        wallets={manager.wallets}
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

      {/* Duy nhất 1 AuthModal tại Root level điều khiển bằng Global State isAuthModalOpen */}
      <AuthModal />

      {/* Floating Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-70 max-w-sm w-[90%] bg-[#3e332a] text-[#fdf8f0] px-4 py-3 rounded-2xl shadow-2xl border border-[#ebdcc9]/40 flex items-center justify-center gap-2 text-xs font-semibold animate-in slide-in-from-top-4 fade-in duration-200">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
