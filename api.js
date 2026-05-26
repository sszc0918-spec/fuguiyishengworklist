// api.js – Firestore API layer
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, startAfter, getDocs, where, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 延迟获取数据库实例（等待 Firebase 初始化）
let db = null;

function getDb() {
  if (!db) {
    db = getFirestore(); // 使用默认初始化的应用
  }
  return db;
}

function getCurrentAccount() {
  return globalThis.currentAccount || 'AAA';
}

function getAccountCollectionName(account, collectionName) {
  if (account === 'AAA') return collectionName;
  return `${collectionName}_${account}`;
}

function getTasksCollection() {
  const account = getCurrentAccount();
  return collection(getDb(), getAccountCollectionName(account, 'tasks'));
}

export const PAGE_SIZE = 20;

export async function fetchTasksPage(lastDoc = null, filters = {}) {
  let colRef = getTasksCollection();
  if (filters.department) {
    colRef = query(colRef, where("department", "==", filters.department));
  }
  let q = query(colRef, orderBy("dueDate", "desc"));
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  q = query(q, limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const tasks = [];
  snap.forEach(d => tasks.push({ id: d.id, ...d.data() }));
  const lastVisible = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { tasks, lastVisible };
}

export async function createTask(task) {
  const now = new Date();
  return await addDoc(getTasksCollection(), {
    ...task,
    completed: false,
    archived: false,
    createdAt: Timestamp.fromDate(now)
  });
}

export async function updateTask(id, data) {
  return await updateDoc(doc(getTasksCollection(), id), data);
}

export async function deleteTask(id) {
  return await deleteDoc(doc(getTasksCollection(), id));
}
