'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { formatCents } from '@/lib/utils';

const USERS = [
  { id: 'user-feras-001', name: 'Feras', color: 'bg-blue-500' },
  { id: 'user-ahmed-002', name: 'Ahmed', color: 'bg-green-500' },
  { id: 'user-sarah-003', name: 'Sarah', color: 'bg-purple-500' },
];

interface WalletTransaction {
  id: string;
  senderId: string;
  receiverId: string;
  amountCents: number;
  type: string;
  referenceId: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  receiver: { id: string; name: string };
}

interface QRGenerateResponse {
  success: boolean;
  data?: {
    token: string;
    qrCodeDataUrl: string;
    expiresIn: number;
    user: { id: string; name: string };
    requestedAmountCents: number | null;
  };
  message?: string;
}

interface QRTransferResponse {
  success: boolean;
  message: string;
  senderBalance?: number;
  receiverBalance?: number;
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export default function WalletPage() {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // QR Generation
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState(0);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrAmount, setQrAmount] = useState('');
  const [qrExpirySeconds, setQrExpirySeconds] = useState(60);

  // QR Scanner
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<{ success: boolean; message: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Fetch user balance and transactions
  const fetchUserData = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const [balanceRes, txRes] = await Promise.all([
        fetch(`/api/wallet/balance?userId=${selectedUser}`),
        fetch(`/api/wallet/transactions?userId=${selectedUser}&limit=20`),
      ]);
      
      const balanceData = await balanceRes.json();
      const txData = await txRes.json();

      if (balanceData.success) setBalance(balanceData.data.balance);
      if (txData.success) setTransactions(txData.data);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [selectedUser]);

  // Generate QR Code
  const handleGenerateQR = async () => {
    if (!selectedUser) return;
    const user = USERS.find(u => u.id === selectedUser);
    if (!user) return;

    setQrGenerating(true);
    try {
      const response = await fetch('/api/wallet/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          userName: user.name,
          requestedAmountCents: qrAmount ? Math.round(parseFloat(qrAmount) * 100) : undefined,
          expirySeconds: qrExpirySeconds,
        }),
      });

      const data: QRGenerateResponse = await response.json();

      if (data.success && data.data) {
        setQrCodeDataUrl(data.data.qrCodeDataUrl);
        setQrToken(data.data.token);
        setQrExpiry(Date.now() + data.data.expiresIn * 1000);
      } else {
        alert(data.message || 'Failed to generate QR code');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setQrGenerating(false);
    }
  };

  // Start QR Scanner
  const startScanner = async () => {
    if (!scannerContainerRef.current) return;

    // Check for HTTPS (required for camera)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert('Camera requires HTTPS. Please use the manual token input below, or access via HTTPS.');
      return;
    }

    try {
      const scanner = new Html5Qrcode('qr-scanner');
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          setScanning(false);
          setScanResult(decodedText);
          scanner.stop().catch(console.error);
        },
        (error: string) => {}
      );

      scannerRef.current = scanner;
      setScanning(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      alert('Could not access camera. Please ensure you\'re on HTTPS and grant camera permissions, or use manual token input.');
    }
  };

  // Stop QR Scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Handle QR Scan Result - Transfer
  const handleTransferFromQR = async () => {
    if (!scanResult || !selectedUser) return;

    setTransferring(true);
    setTransferResult(null);

    try {
      const response = await fetch('/api/wallet/qr/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: selectedUser,
          token: scanResult,
        }),
      });

      const data: QRTransferResponse = await response.json();
      setTransferResult({ success: data.success, message: data.message });

      if (data.success) {
        setBalance(data.senderBalance || 0);
        fetchUserData();
        setScanResult(null);
      }
    } catch (err) {
      setTransferResult({ success: false, message: 'Network error' });
    } finally {
      setTransferring(false);
    }
  };

  // Format time remaining for QR expiry
  const getTimeRemaining = () => {
    if (!qrExpiry) return 0;
    return Math.max(0, Math.ceil((qrExpiry - Date.now()) / 1000));
  };

  const selectedUserData = USERS.find(u => u.id === selectedUser);

  return (
    <main className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900">Wallet</h1>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* User Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Select User</label>
          <div className="grid grid-cols-3 gap-3">
            {USERS.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user.id)}
                className={cn(
                  'relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2',
                  selectedUser === user.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', user.color)}>
                  <span className="text-white font-medium text-sm">{user.name[0]}</span>
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  selectedUser === user.id ? 'text-primary-600' : 'text-slate-700'
                )}>
                  {user.name}
                </span>
                {selectedUser === user.id && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedUser && (
          <>
            {/* Balance Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white p-6 shadow-lg shadow-primary-500/25">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm opacity-80 font-medium">Current Balance</span>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-5xl font-bold tracking-tight mb-2">{formatCents(balance)}</div>
              <p className="text-sm opacity-70">{selectedUserData?.name}'s Wallet</p>
            </div>

            {/* QR Code Generator */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h-.08M12 12.5V12m3.249 7.05l4.157-4.157a.4.4 0 00-.566-.565L12 17.883l-3.843-3.843a.4.4 0 00-.566 0L6.05 15.88a.4.4 0 000 .566l4.157 4.157M12 12.5V12" />
                  </svg>
                </div>
                <span>Generate QR Code</span>
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Request Amount (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input
                      type="number"
                      value={qrAmount}
                      onChange={(e) => setQrAmount(e.target.value)}
                      placeholder="15.00"
                      className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-lg transition-all"
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expiry: <span className="text-primary-600 font-semibold">{qrExpirySeconds}s</span>
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="300"
                    step="30"
                    value={qrExpirySeconds}
                    onChange={(e) => setQrExpirySeconds(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>

                <button
                  onClick={handleGenerateQR}
                  disabled={qrGenerating}
                  className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-base hover:bg-primary-700 focus:ring-2 focus:ring-primary-500/30 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {qrGenerating ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate QR Code'
                  )}
                </button>
              </div>

              {qrCodeDataUrl && (
                <div className="pt-4 border-t border-slate-100 space-y-4 animate-fade-in">
                  <div className="text-center">
                    <div className="inline-block p-4 bg-white rounded-xl shadow-inner">
                      <img src={qrCodeDataUrl} alt="QR Code" className="w-56 h-56" />
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                      Expires in <span className="font-medium text-slate-700">{getTimeRemaining()}s</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1 font-mono">
                    <p>Token: {qrToken?.slice(0, 24)}...</p>
                    {qrAmount && (
                      <p className="text-primary-600 font-medium">
                        Requests: {formatCents(Math.round(parseFloat(qrAmount) * 100))}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* QR Code Scanner / Manual Input */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span>Receive Money</span>
              </h3>

              <p className="text-sm text-slate-500">Scan a QR code or paste the token below to receive money.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">QR Token</label>
                  <input
                    type="text"
                    value={scanResult || ''}
                    onChange={(e) => setScanResult(e.target.value)}
                    placeholder="Paste QR token here..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all font-mono"
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {!scanning ? (
                    <button
                      onClick={startScanner}
                      className="col-span-2 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h-.08M12 12.5V12m3.249 7.05l4.157-4.157a.4.4 0 00-.566-.565L12 17.883l-3.843-3.843a.4.4 0 00-.566 0L6.05 15.88a.4.4 0 000 .566l4.157 4.157M12 12.5V12" />
                      </svg>
                      Open Camera to Scan
                    </button>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <div ref={scannerContainerRef} id="qr-scanner" className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden" />
                      </div>
                      <button
                        onClick={stopScanner}
                        className="col-span-2 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Stop Scanning
                      </button>
                    </>
                  )}

                  {scanResult && !scanning && (
                    <div className="col-span-2 space-y-3 p-4 bg-slate-50 rounded-xl border animate-slide-up">
                      <p className="text-sm font-medium text-slate-900">Token Detected</p>
                      <p className="text-xs text-slate-500 font-mono break-all bg-white px-3 py-2 rounded-lg">{scanResult.slice(0, 60)}...</p>
                      <button
                        onClick={handleTransferFromQR}
                        disabled={transferring}
                        className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 focus:ring-2 focus:ring-green-500/30 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {transferring ? (
                          <>
                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Transferring...
                          </>
                        ) : (
                          'Confirm & Receive Money'
                        )}
                      </button>
                      {transferResult && (
                        <div className={cn(
                          'p-3 text-sm rounded-xl flex items-center gap-2 animate-slide-up',
                          transferResult.success 
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                        )}>
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            {transferResult.success ? (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            ) : (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm8.707-7.707a1 1 0 00-1.414-1.414L10 10.586 8.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            )}
                          </svg>
                          <span>{transferResult.message}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setScanResult(null)}
                        className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
                {loading && (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">No transactions yet</p>
                  <p className="text-xs text-slate-400 mt-1">Your transaction history will appear here</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-11 h-11 rounded-xl flex items-center justify-center',
                          tx.senderId === selectedUser ? 'bg-red-100' : 'bg-green-100'
                        )}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {tx.senderId === selectedUser ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9" stroke="rgb(239, 68, 68)" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="rgb(34, 197, 94)" />
                            )}
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {tx.senderId === selectedUser ? `Sent to ${tx.receiver.name}` : `Received from ${tx.sender.name}`}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">{tx.type.replace('_', ' ').toLowerCase()}</p>
                        </div>
                      </div>
                      <span className={cn(
                        'font-semibold text-lg',
                        tx.senderId === selectedUser ? 'text-red-600' : 'text-green-600'
                      )}>
                        {tx.senderId === selectedUser ? '-' : '+'}{formatCents(tx.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </main>
  );
}