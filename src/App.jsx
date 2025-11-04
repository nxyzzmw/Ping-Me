// -----------------------------
// App.jsx — PingMe (Final Version with Seen, Unread & Responsive Fixes)
// -----------------------------
import React, { useState, useEffect } from "react";
const motion = { div: (props) => <div {...props} /> };

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { Send, LogOut, MessageCircle } from "lucide-react";

// -----------------------------
// Firebase Config
// -----------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCVJ-Js5Eioi6C7NO3IKkP9ZAGfpBMfvDg",
  authDomain: "ping-me-cb96c.firebaseapp.com",
  projectId: "ping-me-cb96c",
  storageBucket: "ping-me-cb96c.appspot.com",
  messagingSenderId: "229422249517",
  appId: "1:229422249517:web:bd0a1f917e1cca2834eaa4",
  measurementId: "G-VSBNP2YSJS",
};

// -----------------------------
// Firebase Initialization
// -----------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// -----------------------------
// Helper Functions
// -----------------------------
const getChatId = (uid1, uid2) => [uid1, uid2].sort().join("_");

const formatTimestamp = (ts) => {
  if (!ts) return "";
  const date = new Date(ts);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

// -----------------------------
// Main Component
// -----------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});

  // -----------------------------
  // Auth Handling
  // -----------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            uid: currentUser.uid,
            status: "online",
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
      } else setUser(null);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => await signInWithPopup(auth, provider);

  const handleSignOut = async () => {
    if (user)
      await updateDoc(doc(db, "users", user.uid), { status: "offline" });
    signOut(auth);
    setActiveChat(null);
  };

  // -----------------------------
  // Fetch Users + Unread Counts
  // -----------------------------
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(collection(db, "users"), async (snapshot) => {
      const list = snapshot.docs
        .map((doc) => doc.data())
        .filter((u) => u.uid !== user.uid);

      const counts = {};
      for (const u of list) {
        const chatId = getChatId(user.uid, u.uid);
        const msgRef = collection(db, "messages", chatId, "chats");
        const unseenSnap = await getDocs(
          query(
            msgRef,
            where("receiverId", "==", user.uid),
            where("status", "==", "sent")
          )
        );
        counts[u.uid] = unseenSnap.size;
      }

      setUsers(list);
      setUnreadCounts(counts);
    });

    return () => unsub();
  }, [user]);

  // -----------------------------
  // Fetch Messages + Update Status
  // -----------------------------
  useEffect(() => {
    if (!user || !activeChat) return;

    const chatId = getChatId(user.uid, activeChat.uid);
    const q = query(collection(db, "messages", chatId, "chats"), orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // Update delivered
      const delivered = msgs.filter(
        (m) => m.receiverId === user.uid && m.status === "sent"
      );
      for (const m of delivered) {
        await updateDoc(doc(db, "messages", chatId, "chats", m.id), {
          status: "delivered",
        });
      }

      // Mark seen if chat is open
      const unseen = msgs.filter(
        (m) => m.receiverId === user.uid && m.status !== "seen"
      );
      if (unseen.length > 0) {
        for (const m of unseen) {
          await updateDoc(doc(db, "messages", chatId, "chats", m.id), {
            status: "seen",
          });
        }
      }
    });
    return () => unsub();
  }, [activeChat, user]);

  // -----------------------------
  // Send Message
  // -----------------------------
  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    const chatId = getChatId(user.uid, activeChat.uid);
    const ref = collection(db, "messages", chatId, "chats");
    await addDoc(ref, {
      text: input,
      senderId: user.uid,
      receiverId: activeChat.uid,
      timestamp: serverTimestamp(),
      status: "sent",
    });
    setInput("");
  };

  // -----------------------------
  // UI Render
  // -----------------------------
  if (authLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
      </div>
    );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
      {/* Sidebar */}
      {user && (
        <div
          className={`fixed inset-0 z-20 bg-gray-900 md:static md:z-auto md:w-1/3 lg:w-1/4 flex flex-col border-r border-gray-700 transition-transform duration-300 ${
            activeChat ? "-translate-x-full md:translate-x-0" : "translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center gap-3">
              <img
                src={user.photoURL}
                alt="me"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover"
              />
              <h2 className="font-semibold text-xl">Chats</h2>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-red-400 hover:text-red-500 text-sm"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {users.map((u) => (
              <div
                key={u.uid}
                onClick={async () => {
                  setActiveChat(u);

                  // 🔵 Mark all unseen messages as seen
                  const chatId = getChatId(user.uid, u.uid);
                  const msgRef = collection(db, "messages", chatId, "chats");
                  const unseenSnap = await getDocs(
                    query(
                      msgRef,
                      where("receiverId", "==", user.uid),
                      where("status", "in", ["sent", "delivered"])
                    )
                  );

                  for (const docSnap of unseenSnap.docs) {
                    await updateDoc(
                      doc(db, "messages", chatId, "chats", docSnap.id),
                      { status: "seen" }
                    );
                  }

                  // Reset unread badge locally
                  setUnreadCounts((prev) => ({ ...prev, [u.uid]: 0 }));
                }}
                className="p-3 flex items-center justify-between hover:bg-gray-700 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.photoURL}
                    alt={u.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium">{u.displayName}</p>
                    <p
                      className={`text-xs ${
                        u.status === "online"
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {u.status === "online" ? "online" : "offline"}
                    </p>
                  </div>
                </div>
                {unreadCounts[u.uid] > 0 && (
                  <div className="bg-blue-600 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                    {unreadCounts[u.uid]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {!user ? (
          <div className="flex flex-col items-center justify-center h-full">
            <MessageCircle size={64} className="text-blue-500 mb-4" />
            <h1 className="text-3xl font-bold mb-2">PingMe</h1>
            <p className="mb-4">Sign in to start chatting privately</p>
            <button
              onClick={handleSignIn}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow"
            >
              Sign in with Google
            </button>
          </div>
        ) : !activeChat ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle size={60} className="mb-4" />
            <p>Select a chat to start messaging</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-gray-800 border-b border-gray-700">
              <button
                className="md:hidden text-blue-400 text-lg font-bold"
                onClick={() => setActiveChat(null)}
              >
                ←
              </button>
              <img
                src={activeChat.photoURL}
                alt={activeChat.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold">{activeChat.displayName}</p>
                <p className="text-xs text-green-400">online</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderId === user.uid ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                      msg.senderId === user.uid
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-gray-700 text-gray-100 rounded-bl-none"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <p className="text-[10px] text-right opacity-70 mt-1 flex items-center justify-end gap-1">
                      {msg.timestamp?.seconds
                        ? formatTimestamp(msg.timestamp.seconds * 1000)
                        : ""}
                      {msg.senderId === user.uid && (
                        <span
                          className={`ml-1 ${
                            msg.status === "seen"
                              ? "text-blue-400"
                              : "text-gray-300"
                          }`}
                        >
                          {msg.status === "sent"
                            ? "✓"
                            : msg.status === "delivered"
                            ? "✓✓"
                            : "✓✓"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-gray-800 flex items-center gap-2 border-t border-gray-700">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message"
                className="flex-1 bg-gray-700 rounded-lg px-3 py-2 outline-none text-sm text-white"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg"
              >
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
