import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Wallet, Ledger, Category } from '../types';

/**
 * Lưu hoặc cập nhật một giao dịch lên Firestore (users/{uid}/transactions/{id})
 * Firestore tự động lưu vào cache offline nếu thiết bị mất mạng.
 */
export async function syncTransactionToFirestore(uid: string, tx: Transaction): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'transactions', tx.id);
    await setDoc(docRef, tx, { merge: true });
  } catch (err) {
    console.warn('Lỗi ghi giao dịch lên Firestore:', err);
  }
}

/**
 * Xóa một giao dịch trên Firestore
 */
export async function removeTransactionFromFirestore(uid: string, id: string): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'transactions', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Lỗi xóa giao dịch trên Firestore:', err);
  }
}

/**
 * Lưu hoặc cập nhật ví tiền lên Firestore (users/{uid}/wallets/{id})
 */
export async function syncWalletToFirestore(uid: string, wallet: Wallet): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'wallets', wallet.id);
    await setDoc(docRef, wallet, { merge: true });
  } catch (err) {
    console.warn('Lỗi ghi ví lên Firestore:', err);
  }
}

/**
 * Xóa một ví tiền trên Firestore
 */
export async function removeWalletFromFirestore(uid: string, id: string): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'wallets', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Lỗi xóa ví trên Firestore:', err);
  }
}

/**
 * Lưu hoặc cập nhật Sổ chi tiêu lên Firestore (users/{uid}/ledgers/{id})
 */
export async function syncLedgerToFirestore(uid: string, ledger: Ledger): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'ledgers', ledger.id);
    await setDoc(docRef, ledger, { merge: true });
  } catch (err) {
    console.warn('Lỗi ghi sổ lên Firestore:', err);
  }
}

/**
 * Xóa một sổ chi tiêu trên Firestore
 */
export async function removeLedgerFromFirestore(uid: string, id: string): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'ledgers', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Lỗi xóa sổ trên Firestore:', err);
  }
}

/**
 * Lắng nghe thay đổi dữ liệu thời gian thực từ Firestore với hỗ trợ offline
 */
export function subscribeToUserFirestoreData(
  uid: string,
  callbacks: {
    onTransactions?: (items: Transaction[]) => void;
    onWallets?: (items: Wallet[]) => void;
    onLedgers?: (items: Ledger[]) => void;
    onCategories?: (items: Category[]) => void;
  }
): () => void {
  if (!db || !uid) return () => {};

  const unsubs: Array<() => void> = [];

  // Lắng nghe transactions
  if (callbacks.onTransactions) {
    const txCol = collection(db, 'users', uid, 'transactions');
    const unsub = onSnapshot(
      txCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Transaction[] = [];
          snapshot.forEach((d) => list.push(d.data() as Transaction));
          callbacks.onTransactions?.(list);
        }
      },
      (error) => {
        console.warn('Lỗi lắng nghe transactions Firestore:', error);
      }
    );
    unsubs.push(unsub);
  }

  // Lắng nghe wallets
  if (callbacks.onWallets) {
    const walletCol = collection(db, 'users', uid, 'wallets');
    const unsub = onSnapshot(
      walletCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Wallet[] = [];
          snapshot.forEach((d) => list.push(d.data() as Wallet));
          callbacks.onWallets?.(list);
        }
      },
      (error) => {
        console.warn('Lỗi lắng nghe wallets Firestore:', error);
      }
    );
    unsubs.push(unsub);
  }

  // Lắng nghe ledgers
  if (callbacks.onLedgers) {
    const ledgerCol = collection(db, 'users', uid, 'ledgers');
    const unsub = onSnapshot(
      ledgerCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Ledger[] = [];
          snapshot.forEach((d) => list.push(d.data() as Ledger));
          callbacks.onLedgers?.(list);
        }
      },
      (error) => {
        console.warn('Lỗi lắng nghe ledgers Firestore:', error);
      }
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

/**
 * Tải trực tiếp dữ liệu từ Firestore xuống (dùng khi vừa đăng nhập xong)
 */
export async function pullUserDataFromFirestore(uid: string): Promise<{
  transactions: Transaction[];
  wallets: Wallet[];
  ledgers: Ledger[];
} | null> {
  if (!db || !uid) return null;
  try {
    const txSnap = await getDocs(collection(db, 'users', uid, 'transactions'));
    const walletSnap = await getDocs(collection(db, 'users', uid, 'wallets'));
    const ledgerSnap = await getDocs(collection(db, 'users', uid, 'ledgers'));

    const transactions: Transaction[] = [];
    txSnap.forEach((d) => transactions.push(d.data() as Transaction));
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const wallets: Wallet[] = [];
    walletSnap.forEach((d) => wallets.push(d.data() as Wallet));

    const ledgers: Ledger[] = [];
    ledgerSnap.forEach((d) => ledgers.push(d.data() as Ledger));

    return { transactions, wallets, ledgers };
  } catch (err) {
    console.warn('Lỗi tải dữ liệu Firestore:', err);
    return null;
  }
}

/**
 * Đẩy toàn bộ dữ liệu cục bộ lên Firestore (Đồng bộ thủ công)
 */
export async function uploadAllLocalDataToFirestore(
  uid: string,
  data: {
    transactions: Transaction[];
    wallets: Wallet[];
    ledgers: Ledger[];
  }
): Promise<{ success: boolean; count: number }> {
  if (!db || !uid) return { success: false, count: 0 };
  try {
    let count = 0;
    for (const tx of data.transactions) {
      const docRef = doc(db, 'users', uid, 'transactions', tx.id);
      await setDoc(docRef, tx, { merge: true });
      count++;
    }
    for (const w of data.wallets) {
      const docRef = doc(db, 'users', uid, 'wallets', w.id);
      await setDoc(docRef, w, { merge: true });
    }
    for (const l of data.ledgers) {
      const docRef = doc(db, 'users', uid, 'ledgers', l.id);
      await setDoc(docRef, l, { merge: true });
    }
    return { success: true, count };
  } catch (err) {
    console.error('Lỗi đẩy dữ liệu lên Firestore:', err);
    return { success: false, count: 0 };
  }
}

