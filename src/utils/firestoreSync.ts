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
 * Hàm làm sạch dữ liệu (Sanitize Data) đệ quy trước khi gửi lên Firestore:
 * - Quét qua toàn bộ Object/Array.
 * - Loại bỏ hoặc chuyển đổi bất kỳ key nào có giá trị là `undefined` (xóa khỏi object hoặc chuyển thành null).
 * - Đảm bảo trường `toWalletId` nếu không phải là transfer thì luôn là null (hoặc chuỗi rỗng), tuyệt đối không để undefined.
 * - Bắt buộc bọc payload bằng hàm này trước khi gọi setDoc, addDoc, updateDoc trên toàn bộ dự án.
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    // Nếu là Date instance
    if (data instanceof Date) {
      return data.toISOString() as unknown as T;
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        if (key === 'toWalletId') {
          cleanObj[key] = null;
        }
        // Các trường khác có value undefined: xóa khỏi object để Firestore không quăng lỗi
        continue;
      } else if (value !== null && typeof value === 'object') {
        cleanObj[key] = sanitizeFirestoreData(value);
      } else {
        cleanObj[key] = value;
      }
    }

    // Đặc biệt kiểm tra đối với giao dịch: nếu không phải transfer, đảm bảo toWalletId là null
    if ('type' in cleanObj && cleanObj.type !== 'transfer') {
      cleanObj.toWalletId = null;
    }

    return cleanObj as T;
  }

  return data;
}

/**
 * Lấy mốc thời gian timestamp từ entity
 */
function getEntityTimestamp(item: { updatedAt?: string; createdAt?: string; date?: string }): number {
  const timeStr = item.updatedAt || item.createdAt || item.date;
  if (!timeStr) return 0;
  const t = new Date(timeStr).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Thuật toán Gộp dữ liệu (Merge Algorithm) an toàn:
 * - Những giao dịch có ở Local nhưng chưa có trên Cloud -> Thêm vào mảng.
 * - Những giao dịch có trên Cloud nhưng chưa có ở Local -> Thêm vào mảng.
 * - Nếu trùng ID: Giữ lại bản ghi có thời gian cập nhật (updatedAt hoặc createdAt) mới hơn.
 */
export function mergeEntitiesById<T extends { id: string; updatedAt?: string; createdAt?: string; date?: string }>(
  localList: T[],
  cloudList: T[]
): T[] {
  const map = new Map<string, T>();

  // 1. Thêm tất cả item từ Local vào Map
  for (const item of localList) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }

  // 2. So sánh và gộp với Cloud
  for (const cloudItem of cloudList) {
    if (!cloudItem || !cloudItem.id) continue;
    const localItem = map.get(cloudItem.id);
    if (!localItem) {
      // Có trên Cloud nhưng chưa có ở Local -> Thêm vào Local
      map.set(cloudItem.id, cloudItem);
    } else {
      // Trùng ID: Giữ lại bản ghi có thời gian mới hơn
      const cloudTime = getEntityTimestamp(cloudItem);
      const localTime = getEntityTimestamp(localItem);
      if (cloudTime > localTime) {
        map.set(cloudItem.id, cloudItem);
      }
    }
  }

  return Array.from(map.values());
}

export interface TwoWaySyncPayload {
  transactions: Transaction[];
  wallets: Wallet[];
  ledgers: Ledger[];
  categories: Category[];
}

export interface TwoWaySyncResult {
  success: boolean;
  mergedData?: TwoWaySyncPayload;
  count?: number;
  message?: string;
}

/**
 * Thuật toán Đồng bộ 2 chiều (Two-Way Sync):
 * Bước 1: Fetch (tải) dữ liệu mới nhất từ Firestore Cloud về.
 * Bước 2: So sánh và Gộp dữ liệu (Merge) Local & Cloud dựa trên ID duy nhất và timestamp.
 * Bước 3: Caller ghi đè mảng đã được gộp xuống LocalStorage.
 * Bước 4: Đẩy (Upload) mảng đã gộp hoàn chỉnh đó ngược lên lại Firestore Cloud để làm chuẩn cho các thiết bị khác.
 */
export async function performTwoWaySync(
  uid: string,
  localData: TwoWaySyncPayload
): Promise<TwoWaySyncResult> {
  if (!db || !uid) {
    const err = 'Chưa đăng nhập tài khoản hoặc chưa kết nối Firebase.';
    alert('Lỗi Firebase: ' + err);
    return { success: false, message: err };
  }

  try {
    // Bước 1: Fetch (tải) dữ liệu mới nhất từ Firestore Cloud về
    const txSnap = await getDocs(collection(db, 'users', uid, 'transactions'));
    const walletSnap = await getDocs(collection(db, 'users', uid, 'wallets'));
    const ledgerSnap = await getDocs(collection(db, 'users', uid, 'ledgers'));
    const catSnap = await getDocs(collection(db, 'users', uid, 'categories'));

    const cloudTransactions: Transaction[] = [];
    txSnap.forEach((d) => cloudTransactions.push(d.data() as Transaction));

    const cloudWallets: Wallet[] = [];
    walletSnap.forEach((d) => cloudWallets.push(d.data() as Wallet));

    const cloudLedgers: Ledger[] = [];
    ledgerSnap.forEach((d) => cloudLedgers.push(d.data() as Ledger));

    const cloudCategories: Category[] = [];
    catSnap.forEach((d) => cloudCategories.push(d.data() as Category));

    // Bước 2: Gộp dữ liệu (Merge)
    const mergedTransactions = mergeEntitiesById(localData.transactions, cloudTransactions);
    mergedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const mergedWallets = mergeEntitiesById(localData.wallets, cloudWallets);
    const mergedLedgers = mergeEntitiesById(localData.ledgers, cloudLedgers);
    const mergedCategories = mergeEntitiesById(localData.categories, cloudCategories);

    const mergedData: TwoWaySyncPayload = {
      transactions: mergedTransactions,
      wallets: mergedWallets,
      ledgers: mergedLedgers,
      categories: mergedCategories,
    };

    // Bước 4: Đẩy (Upload) mảng đã gộp hoàn chỉnh ngược lên lại Firestore Cloud (bọc sanitize)
    for (const tx of mergedTransactions) {
      const cleanTx = sanitizeFirestoreData(tx);
      await setDoc(doc(db, 'users', uid, 'transactions', tx.id), cleanTx, { merge: true });
    }
    for (const w of mergedWallets) {
      const cleanW = sanitizeFirestoreData(w);
      await setDoc(doc(db, 'users', uid, 'wallets', w.id), cleanW, { merge: true });
    }
    for (const l of mergedLedgers) {
      const cleanL = sanitizeFirestoreData(l);
      await setDoc(doc(db, 'users', uid, 'ledgers', l.id), cleanL, { merge: true });
    }
    for (const c of mergedCategories) {
      const cleanC = sanitizeFirestoreData(c);
      await setDoc(doc(db, 'users', uid, 'categories', c.id), cleanC, { merge: true });
    }

    return {
      success: true,
      mergedData,
      count: mergedTransactions.length,
      message: `Đồng bộ thành công ${mergedTransactions.length} giao dịch!`,
    };
  } catch (err: any) {
    console.error('Lỗi thực hiện 2-Way Sync Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
    return {
      success: false,
      message: 'Lỗi Firebase: ' + (err?.message || String(err)),
    };
  }
}

/**
 * Lưu hoặc cập nhật một giao dịch lên Firestore (users/{uid}/transactions/{id})
 */
export async function syncTransactionToFirestore(uid: string, tx: Transaction): Promise<void> {
  if (!db || !uid) return;
  try {
    const cleanTx = sanitizeFirestoreData(tx);
    const docRef = doc(db, 'users', uid, 'transactions', tx.id);
    await setDoc(docRef, cleanTx, { merge: true });
  } catch (err: any) {
    console.warn('Lỗi ghi giao dịch lên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
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
  } catch (err: any) {
    console.warn('Lỗi xóa giao dịch trên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
  }
}

/**
 * Lưu hoặc cập nhật ví tiền lên Firestore (users/{uid}/wallets/{id})
 */
export async function syncWalletToFirestore(uid: string, wallet: Wallet): Promise<void> {
  if (!db || !uid) return;
  try {
    const cleanWallet = sanitizeFirestoreData(wallet);
    const docRef = doc(db, 'users', uid, 'wallets', wallet.id);
    await setDoc(docRef, cleanWallet, { merge: true });
  } catch (err: any) {
    console.warn('Lỗi ghi ví lên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
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
  } catch (err: any) {
    console.warn('Lỗi xóa ví trên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
  }
}

/**
 * Lưu hoặc cập nhật Sổ chi tiêu lên Firestore (users/{uid}/ledgers/{id})
 */
export async function syncLedgerToFirestore(uid: string, ledger: Ledger): Promise<void> {
  if (!db || !uid) return;
  try {
    const cleanLedger = sanitizeFirestoreData(ledger);
    const docRef = doc(db, 'users', uid, 'ledgers', ledger.id);
    await setDoc(docRef, cleanLedger, { merge: true });
  } catch (err: any) {
    console.warn('Lỗi ghi sổ lên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
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
  } catch (err: any) {
    console.warn('Lỗi xóa sổ trên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
  }
}

/**
 * Lưu hoặc cập nhật danh mục lên Firestore (users/{uid}/categories/{id})
 */
export async function syncCategoryToFirestore(uid: string, cat: Category): Promise<void> {
  if (!db || !uid) return;
  try {
    const cleanCat = sanitizeFirestoreData(cat);
    const docRef = doc(db, 'users', uid, 'categories', cat.id);
    await setDoc(docRef, cleanCat, { merge: true });
  } catch (err: any) {
    console.warn('Lỗi ghi danh mục lên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
  }
}

/**
 * Xóa một danh mục trên Firestore
 */
export async function removeCategoryFromFirestore(uid: string, id: string): Promise<void> {
  if (!db || !uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'categories', id);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('Lỗi xóa danh mục trên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
  }
}

/**
 * Lắng nghe thay đổi dữ liệu thời gian thực từ Firestore với hỗ trợ offline (onSnapshot)
 */
export function subscribeToUserFirestoreData(
  uid: string,
  callbacks: {
    onTransactions?: (items: Transaction[], isEmpty: boolean) => void;
    onWallets?: (items: Wallet[], isEmpty: boolean) => void;
    onLedgers?: (items: Ledger[], isEmpty: boolean) => void;
    onCategories?: (items: Category[], isEmpty: boolean) => void;
  }
): () => void {
  if (!db || !uid) return () => {};

  const unsubs: Array<() => void> = [];

  // 1. Lắng nghe transactions
  if (callbacks.onTransactions) {
    const txCol = collection(db, 'users', uid, 'transactions');
    const unsub = onSnapshot(
      txCol,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((d) => list.push(d.data() as Transaction));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callbacks.onTransactions?.(list, snapshot.empty);
      },
      (error: any) => {
        console.warn('Lỗi lắng nghe transactions Firestore:', error);
        alert('Lỗi Firebase: ' + (error?.message || String(error)));
      }
    );
    unsubs.push(unsub);
  }

  // 2. Lắng nghe wallets
  if (callbacks.onWallets) {
    const walletCol = collection(db, 'users', uid, 'wallets');
    const unsub = onSnapshot(
      walletCol,
      (snapshot) => {
        const list: Wallet[] = [];
        snapshot.forEach((d) => list.push(d.data() as Wallet));
        callbacks.onWallets?.(list, snapshot.empty);
      },
      (error: any) => {
        console.warn('Lỗi lắng nghe wallets Firestore:', error);
        alert('Lỗi Firebase: ' + (error?.message || String(error)));
      }
    );
    unsubs.push(unsub);
  }

  // 3. Lắng nghe ledgers
  if (callbacks.onLedgers) {
    const ledgerCol = collection(db, 'users', uid, 'ledgers');
    const unsub = onSnapshot(
      ledgerCol,
      (snapshot) => {
        const list: Ledger[] = [];
        snapshot.forEach((d) => list.push(d.data() as Ledger));
        callbacks.onLedgers?.(list, snapshot.empty);
      },
      (error: any) => {
        console.warn('Lỗi lắng nghe ledgers Firestore:', error);
        alert('Lỗi Firebase: ' + (error?.message || String(error)));
      }
    );
    unsubs.push(unsub);
  }

  // 4. Lắng nghe categories
  if (callbacks.onCategories) {
    const catCol = collection(db, 'users', uid, 'categories');
    const unsub = onSnapshot(
      catCol,
      (snapshot) => {
        const list: Category[] = [];
        snapshot.forEach((d) => list.push(d.data() as Category));
        callbacks.onCategories?.(list, snapshot.empty);
      },
      (error: any) => {
        console.warn('Lỗi lắng nghe categories Firestore:', error);
        alert('Lỗi Firebase: ' + (error?.message || String(error)));
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
  categories: Category[];
} | null> {
  if (!db || !uid) return null;
  try {
    const txSnap = await getDocs(collection(db, 'users', uid, 'transactions'));
    const walletSnap = await getDocs(collection(db, 'users', uid, 'wallets'));
    const ledgerSnap = await getDocs(collection(db, 'users', uid, 'ledgers'));
    const catSnap = await getDocs(collection(db, 'users', uid, 'categories'));

    const transactions: Transaction[] = [];
    txSnap.forEach((d) => transactions.push(d.data() as Transaction));
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const wallets: Wallet[] = [];
    walletSnap.forEach((d) => wallets.push(d.data() as Wallet));

    const ledgers: Ledger[] = [];
    ledgerSnap.forEach((d) => ledgers.push(d.data() as Ledger));

    const categories: Category[] = [];
    catSnap.forEach((d) => categories.push(d.data() as Category));

    return { transactions, wallets, ledgers, categories };
  } catch (err: any) {
    console.warn('Lỗi tải dữ liệu Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
    return null;
  }
}

/**
 * Đẩy toàn bộ dữ liệu cục bộ lên Firestore
 */
export async function uploadAllLocalDataToFirestore(
  uid: string,
  data: {
    transactions: Transaction[];
    wallets: Wallet[];
    ledgers: Ledger[];
    categories?: Category[];
  }
): Promise<{ success: boolean; count: number; message?: string }> {
  if (!db || !uid) return { success: false, count: 0, message: 'Firebase chưa sẵn sàng' };
  try {
    let count = 0;
    for (const tx of data.transactions) {
      const cleanTx = sanitizeFirestoreData(tx);
      const docRef = doc(db, 'users', uid, 'transactions', tx.id);
      await setDoc(docRef, cleanTx, { merge: true });
      count++;
    }
    for (const w of data.wallets) {
      const cleanW = sanitizeFirestoreData(w);
      const docRef = doc(db, 'users', uid, 'wallets', w.id);
      await setDoc(docRef, cleanW, { merge: true });
    }
    for (const l of data.ledgers) {
      const cleanL = sanitizeFirestoreData(l);
      const docRef = doc(db, 'users', uid, 'ledgers', l.id);
      await setDoc(docRef, cleanL, { merge: true });
    }
    if (data.categories) {
      for (const c of data.categories) {
        const cleanC = sanitizeFirestoreData(c);
        const docRef = doc(db, 'users', uid, 'categories', c.id);
        await setDoc(docRef, cleanC, { merge: true });
      }
    }
    return { success: true, count, message: `Đã lưu ${count} giao dịch lên Cloud` };
  } catch (err: any) {
    console.error('Lỗi đẩy dữ liệu lên Firestore:', err);
    alert('Lỗi Firebase: ' + (err?.message || String(err)));
    return { success: false, count: 0, message: 'Lỗi Firebase: ' + (err?.message || String(err)) };
  }
}
