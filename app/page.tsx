"use client";

import React, { useState, useEffect, useRef } from "react";
import { MdSend, MdArrowBack } from "react-icons/md";
import { FaSmile, FaPaperclip } from "react-icons/fa";
import Image from "next/image";
import { TbMessageChatbotFilled } from "react-icons/tb";

// ---------- Types ----------
type Message = { id: string; fromMe: boolean; text?: string; fileDataUrl?: string; time: string };
type Contact = { id: number; name: string; avatar: string; online: boolean; messages: Message[] };

// ---------- Helpers ----------
const formatTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

// ---------- IndexedDB ----------
const DB_NAME = "chatAppDB";
const STORE_NAME = "contacts";

function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveContactsToDB(contacts: Contact[]) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  contacts.forEach(c => store.put(c));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadContactsFromDB(): Promise<Contact[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Contact[]);
    request.onerror = () => reject(request.error);
  });
}

// ---------- Main ----------
export default function FullChatApp() {
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadContactsFromDB();
      if (saved.length > 0) setContacts(saved);
      else {
        setContacts([
          { id: 1, name: "Alice", avatar: "https://i.pravatar.cc/150?img=1", online: true, messages: [] },
          { id: 2, name: "Bob", avatar: "https://i.pravatar.cc/150?img=2", online: false, messages: [] },
          { id: 3, name: "Charlie", avatar: "https://i.pravatar.cc/150?img=3", online: true, messages: [] },
        ]);
      }
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeContactId, contacts]);

  const activeContact = contacts.find(c => c.id === activeContactId);

  const sendMessage = async () => {
    if ((!input.trim() && files.length === 0) || activeContactId === null) return;
    const now = formatTime();
    const newMessages: Message[] = [];

    if (input.trim())
      newMessages.push({ id: String(Date.now()), fromMe: true, text: input, time: now });

    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(f);
      });
      newMessages.push({ id: String(Date.now() + Math.random()), fromMe: true, fileDataUrl: dataUrl, time: now });
    }

    const updated = contacts.map(c =>
      c.id === activeContactId ? { ...c, messages: [...c.messages, ...newMessages] } : c
    );
    setContacts(updated);
    setInput("");
    setFiles([]);
    setShowEmoji(false);
    await saveContactsToDB(updated);

    // auto reply
    setTimeout(async () => {
      const reply: Message = {
        id: String(Date.now() + 1000),
        fromMe: false,
        text: "Received 👍",
        time: formatTime(),
      };
      const updated2 = updated.map(c =>
        c.id === activeContactId ? { ...c, messages: [...c.messages, reply] } : c
      );
      setContacts(updated2);
      await saveContactsToDB(updated2);
    }, 1000);
  };

  const insertEmoji = (emoji: string) => setInput(prev => prev + emoji);

  return (
    <div className="h-screen w-screen flex bg-linear-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Contact List */}
      {activeContactId === null && (
        <div className="w-full flex flex-col backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl m-6 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="text-2xl flex font-bold text-white">
              MyMessenger <TbMessageChatbotFilled className="text-white mt-1 ml-1" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll">
            {contacts.map(c => {
              const last = c.messages[c.messages.length - 1];
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveContactId(c.id)}
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/10 transition-all"
                >
                  <Image width={48} height={48} src={c.avatar} className="w-12 h-12 rounded-full" alt={c.name} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs text-gray-400">{last?.time}</span>
                    </div>
                    <div className="text-sm text-gray-400 truncate">{last?.text || "No messages yet"}</div>
                  </div>
                  {c.online && <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat Window */}
      {activeContactId !== null && activeContact && (
        <div className="flex-1 flex flex-col m-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center p-4 border-b border-white/10">
            <button onClick={() => setActiveContactId(null)} className="mr-4 text-gray-300 hover:text-white transition">
              <MdArrowBack size={24} />
            </button>
            <Image width={40} height={40} src={activeContact.avatar} className="w-10 h-10 rounded-full mr-2" alt={activeContact.name} />
            <div>
              <div className="font-semibold">{activeContact.name}</div>
              <div className="text-xs text-gray-400">{activeContact.online ? "online" : "offline"}</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3  from-gray-800/50 to-gray-900/50">
            {activeContact.messages.map(m => (
              <div
                key={m.id}
                className={`flex transition-all duration-300 ${m.fromMe ? "justify-end animate-fadeInRight" : "justify-start animate-fadeInLeft"}`}
              >
                {!m.fromMe && (
                  <Image width={32} height={32} src={activeContact.avatar} className="w-8 h-8 rounded-full mr-2" alt={activeContact.name} />
                )}
                <div
                  className={`${m.fromMe
                      ? "bg-blue-500/80 text-white"
                      : "bg-white/10 text-white border border-white/10"
                    } px-4 py-2 rounded-2xl max-w-xs shadow-lg backdrop-blur-md`}
                >
                  {m.text}
                  {m.fileDataUrl && (
                    <Image width={200} height={200} src={m.fileDataUrl} className="mt-2 rounded-xl" alt="sent image" />
                  )}
                  <div className="text-[10px] text-gray-300 text-right mt-1">{m.time}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10 flex flex-col gap-2 bg-gray-900/30 backdrop-blur-lg">
            {showEmoji && (
              <div className="flex flex-wrap gap-2 bg-white/10 p-2 rounded-lg">
                {["😀","😂","😍","👍","🎉","😢","😎","❤️","🔥"].map(e => (
                  <button key={e} onClick={() => insertEmoji(e)} className="hover:scale-110 transition">{e}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={() => setShowEmoji(s => !s)} className="hover:text-yellow-400 transition"><FaSmile /></button>
              <label>
                <input type="file" multiple onChange={(e) => e.target.files && setFiles(Array.from(e.target.files))} className="hidden" />
                <FaPaperclip className="cursor-pointer hover:text-blue-400 transition" />
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Type a message..."
                className="flex-1 rounded-full px-4 py-2 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <button onClick={sendMessage} className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition">
                <MdSend />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
